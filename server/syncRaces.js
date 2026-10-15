// Sincronización resiliente de varias fuentes:
//   · runnea  → calendario nacional (solo como fuente de datos, se enlaza a la web oficial)
//   · xipgroc → carreras catalanas con INSCRIPCIÓN DIRECTA por distancia (Championchip)
// Cada fuente tiene su caché en disco; si una falla se usa su última copia buena.
import fs from 'node:fs';
import path from 'node:path';
import { scrapeRunnea } from './runnea.js';
import { scrapeXipgroc } from './xipgroc.js';
import { geocodeMany } from './geocode.js';
import { enrichWithDetails } from './runneaDetails.js';
import { findWebsForRaces } from './webFinder.js';
import { getAiConfig } from './settings.js';
import { scrapeSpartan } from './spartan.js';
import { discoverOcrRaces } from './ocrDiscovery.js';
import { dedupeRaces, isPast, todayLocal } from '../src/lib/raceDedupe.js';

const ROOT = process.cwd();
const CACHE = {
  runnea: path.join(ROOT, '.cache', 'runnea.json'),
  xipgroc: path.join(ROOT, '.cache', 'xipgroc.json'),
  spartan: path.join(ROOT, '.cache', 'spartan.json'),
};
const PUBLIC_SNAPSHOT = path.join(ROOT, 'public', 'races.json');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function getConfig(env = process.env) {
  return {
    sources: (env.RACE_SOURCES || 'xipgroc,spartan,ocr,runnea').split(',').map((s) => s.trim()).filter(Boolean),
    paths: (
      env.RUNNEA_PATHS ||
      '/carreras-populares/calendario/,/carreras-populares/calendario/barcelona/,/carreras-populares/calendario/tarragona/'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    maxPages: Number(env.RUNNEA_MAX_PAGES || 1),
    xipgrocMonths: Number(env.XIPGROC_MONTHS || 6),
    ttlHours: Number(env.RUNNEA_CACHE_HOURS || 12),
  };
}

// Solo carreras en España (y Andorra): runnea mezcla en el calendario maratones de
// Frankfurt, Nueva York, Berlín… como "destacadas".
const FOREIGN =
  /\b(alemania|francia|portugal|italia|reino unido|inglaterra|estados unidos|eeuu|usa|nueva york|new york|berl[ií]n|frankfurt|par[ií]s|londres|london|chicago|boston|tokio|tokyo|lisboa|oporto|porto|roma|mil[aá]n|amsterdam|viena|praga|budapest|atenas|m[eé]xico|argentina|marruecos)\b/i;
export function isInSpain(r) {
  if (r.country) {
    const c = r.country.toLowerCase();
    if (!/^(es|ad|espa|spain|andorra)/.test(c)) return false;
  }
  return !FOREIGN.test(`${r.location || ''} ${r.name || ''}`);
}

async function attachCoords(races, maxNetwork) {
  const q = (r) => r.geoQuery || r.location;
  const coords = await geocodeMany(races.filter((r) => !r.locationUnknown).map(q).filter(Boolean), maxNetwork);
  return races.map((r) => (r.lat == null && !r.locationUnknown && coords[q(r)] ? { ...r, ...coords[q(r)] } : r));
}

// ---------- fuentes ----------
async function loadSource(name, cfg, force, fetcher) {
  const cached = readJson(CACHE[name]);
  const ageH = cached ? (Date.now() - cached.fetchedAt) / 36e5 : Infinity;
  if (!force && cached && ageH < cfg.ttlHours) return { status: 'cache', ...cached, errors: [] };

  const { races, errors } = await fetcher();
  if (races.length) {
    const payload = { fetchedAt: Date.now(), races };
    writeJson(CACHE[name], payload);
    return { status: 'live', ...payload, errors };
  }
  if (cached?.races?.length) return { status: 'stale', ...cached, errors };
  return { status: 'none', fetchedAt: null, races: [], errors };
}

/**
 * @param {object} opts
 * @param {boolean} opts.force          ignora la caché (12 h)
 * @param {number}  opts.geocodeBudget  llamadas máximas a Nominatim
 * @param {number}  opts.detailBudget   fichas de runnea nuevas a leer
 * @param {number}  opts.aiBudget       carreras a revisar con Gemini (web oficial)
 */
export async function syncRaces({ force = false, geocodeBudget = 5, detailBudget = 40, aiBudget, env = process.env } = {}) {
  const cfg = getConfig(env);
  const ai = {
    apiKey: getAiConfig(env).apiKey,
    model: getAiConfig(env).model,
    budget: aiBudget ?? Number(env.AI_WEB_BUDGET_APP || 0),
  };
  const errors = [];
  const status = {};

  // xipgroc
  let xip = [];
  if (cfg.sources.includes('xipgroc')) {
    const res = await loadSource('xipgroc', cfg, force, () =>
      scrapeXipgroc({ months: cfg.xipgrocMonths, ai, priceBudget: detailBudget })
    );
    xip = res.races;
    status.xipgroc = { status: res.status, count: xip.length, fetchedAt: res.fetchedAt };
    errors.push(...res.errors);
  }

  // Spartan / Tough Mudder / DEKA / Spartan Trail (API oficial)
  let spartan = [];
  if (cfg.sources.includes('spartan')) {
    const res = await loadSource('spartan', cfg, force, () => scrapeSpartan());
    spartan = res.races;
    status.spartan = { status: res.status, count: spartan.length, fetchedAt: res.fetchedAt };
    errors.push(...res.errors);
  }

  // Otras OCR (Farinato, Bulldog, Survivor, Hyrox…) descubiertas con Gemini + Google (caché 7 días)
  let ocr = [];
  if (cfg.sources.includes('ocr')) {
    try {
      const res = await discoverOcrRaces({ apiKey: ai.apiKey, model: ai.model });
      ocr = res.races;
      status.ocr = { status: res.cached ? 'cache' : ai.apiKey ? 'live' : 'sin-ia', count: ocr.length };
    } catch (e) {
      errors.push(`ocr: ${e.message}`);
    }
  }

  // runnea (+ web oficial desde cada ficha + correcciones IA)
  let run = [];
  let pendingDetails = 0;
  let aiChecked = 0;
  if (cfg.sources.includes('runnea')) {
    const res = await loadSource('runnea', cfg, force, () => scrapeRunnea(cfg.paths, cfg.maxPages));
    const det = await enrichWithDetails(res.races, { budget: res.status === 'stale' ? 0 : detailBudget });
    const web = await findWebsForRaces(det.races, res.status === 'stale' ? { ...ai, budget: 0 } : ai);
    run = web.races.filter(isInSpain);
    pendingDetails = det.pending;
    aiChecked = web.checked;
    status.runnea = { status: res.status, count: run.length, fetchedAt: res.fetchedAt };
    errors.push(...res.errors, ...det.errors, ...web.errors);
  }

  // Duplicados entre fuentes (prioridad xipgroc > Spartan > OCR IA > runnea) y fuera las pasadas
  const today = todayLocal();
  let races = dedupeRaces([...xip, ...spartan, ...ocr, ...run]).filter((r) => isInSpain(r) && !isPast(r, today));
  races = await attachCoords(races, geocodeBudget);

  const live = Object.values(status).some((s) => s.status === 'live');
  const payload = { fetchedAt: Date.now(), races };
  if (races.length && live) writeJson(PUBLIC_SNAPSHOT, payload);

  const source = live
    ? 'live'
    : Object.values(status).some((s) => s.status === 'cache')
    ? 'cache'
    : races.length
    ? 'stale-cache'
    : 'none';

  return { source, status, ...payload, pendingDetails, aiChecked, errors };
}
