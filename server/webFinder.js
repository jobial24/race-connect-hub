// Busca con Gemini + Google Search la web oficial ACTUAL de una carrera y la
// verifica abriéndola. Ejemplo real: Mitja de Terrassa pasó de mitjaterrassa.cat
// a mitjaterrassa.org; runnea seguía mostrando la antigua.
import fs from 'node:fs';
import path from 'node:path';
import { todayLocal } from '../src/lib/raceDedupe.js';
import { callAI as callGemini } from './ai.js';

const CACHE_FILE = path.resolve(process.cwd(), '.cache', 'ai-webs.json');
const TTL_MS = 30 * 24 * 36e5; // 30 días

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,ca;q=0.8',
};

const AGGREGATORS =
  /runnea\.|finishers\.|carreraspopulares|corriendovoy|runedia|calendariocarreras|ahotu|worldsmarathons|facebook\.|instagram\.|wikipedia\./i;

export function loadWebCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveWebCache(c) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2));
}

export const cacheKey = (race) => race.id || `${race.name}|${race.date}`;

const norm = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Abre la URL y comprueba que existe y que habla de la carrera. */
export async function verifyUrl(url, race) {
  if (!url || !/^https?:\/\//i.test(url)) return { ok: false, reason: 'URL vacía' };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal, redirect: 'follow' });
    const finalUrl = res.url || url;
    if (res.status === 403 || res.status === 429) {
      // existe pero bloquea bots (Cloudflare…): se acepta con menos confianza
      return { ok: true, finalUrl, status: res.status, matches: false };
    }
    if (!res.ok) return { ok: false, finalUrl, status: res.status, reason: `HTTP ${res.status}` };
    const html = norm((await res.text()).slice(0, 400000));
    const words = norm(race.name)
      .replace(/\b(19|20)\d{2}\b/g, ' ')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !['cursa', 'carrera', 'running', 'popular', 'marato', 'maraton', 'edicio', 'edicion'].includes(w));
    const hits = words.filter((w) => html.includes(w)).length;
    return { ok: true, finalUrl, status: res.status, matches: words.length ? hits / words.length >= 0.5 : true };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'tiempo agotado' : e.message };
  } finally {
    clearTimeout(t);
  }
}

/**
 * @param race {name, date, location, link?, officialUrl?}
 * @returns {officialUrl, registrationUrl, date, price, confidence, notes, verified, sources}
 */
export async function findOfficialWeb(race, { apiKey, model, force = false } = {}) {
  const cache = loadWebCache();
  const key = cacheKey(race);
  if (!force && cache[key] && Date.now() - cache[key].at < TTL_MS) return { ...cache[key], cached: true };

  const today = todayLocal();
  const known = race.officialUrl || race.link || '';
  const prompt = `Hoy es ${today}. Busca en Google la web OFICIAL y ACTUAL de esta carrera popular y su página de inscripción.

Carrera: ${race.name}
Lugar: ${race.location || 'España'}
Fecha prevista: ${race.date || 'desconocida'}
${known ? `Web que tenemos (puede estar desactualizada o haber cambiado de dominio): ${known}` : ''}

Reglas:
- La web oficial es la del organizador, NO agregadores (runnea, finishers, ahotu, carreraspopulares…), ni redes sociales.
- Si la carrera ha cambiado de dominio (p. ej. .cat → .org), devuelve el NUEVO.
- registrationUrl: plataforma de inscripción de la próxima edición (rockthesport, sportmaniacs, championchip, etc.) o "" si no la encuentras.
- No inventes URLs: solo las que hayas visto en los resultados de búsqueda.

Responde SOLO con este JSON:
{"officialUrl":"","registrationUrl":"","date":"YYYY-MM-DD o \\"\\"","price":null,"confidence":"alta|media|baja","notes":"una frase"}`;

  const { data, sources, model: usedModel } = await callGemini({ apiKey, model, prompt, search: true });

  const clean = (u) => (typeof u === 'string' ? u.trim() : '');
  let officialUrl = clean(data.officialUrl);
  let registrationUrl = clean(data.registrationUrl);
  if (AGGREGATORS.test(officialUrl)) officialUrl = '';
  if (AGGREGATORS.test(registrationUrl)) registrationUrl = '';

  const [vOff, vReg] = await Promise.all([
    officialUrl ? verifyUrl(officialUrl, race) : null,
    registrationUrl ? verifyUrl(registrationUrl, race) : null,
  ]);

  const result = {
    at: Date.now(),
    query: { name: race.name, date: race.date, location: race.location },
    officialUrl: vOff?.ok ? vOff.finalUrl : '',
    registrationUrl: vReg?.ok ? vReg.finalUrl : '',
    date: /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') ? data.date : '',
    price: Number.isFinite(Number(data.price)) && data.price !== null && data.price !== '' ? Number(data.price) : null,
    confidence: ['alta', 'media', 'baja'].includes(data.confidence) ? data.confidence : 'media',
    notes: String(data.notes || '').slice(0, 300),
    verified: Boolean(vOff?.ok && vOff.matches),
    rejected: [
      officialUrl && !vOff?.ok ? `${officialUrl} (${vOff?.reason})` : '',
      registrationUrl && !vReg?.ok ? `${registrationUrl} (${vReg?.reason})` : '',
    ].filter(Boolean),
    sources: sources.slice(0, 5),
    model: usedModel,
  };

  cache[key] = result;
  saveWebCache(cache);
  return result;
}

/** Aplica a una carrera lo encontrado por la IA (si es fiable). */
export function applyWebFinding(race, f) {
  if (!f || (!f.officialUrl && !f.registrationUrl)) return race;
  if (!f.verified && f.confidence === 'baja') return race; // poco fiable: no pisar lo que había
  const officialUrl = f.officialUrl || race.officialUrl || '';
  const registrationUrl = f.registrationUrl || race.registrationUrl || '';
  return {
    ...race,
    officialUrl,
    registrationUrl,
    link: registrationUrl || officialUrl || race.link,
    webCheckedAt: f.at,
    webVerified: f.verified,
    ...(race.price == null && f.price != null ? { price: f.price } : {}),
  };
}

/** Revisa con IA las carreras aún sin revisar (lote limitado por la cuota gratuita). */
export async function findWebsForRaces(races, { apiKey, model, budget = 10 } = {}) {
  const cache = loadWebCache();
  const out = [];
  let used = 0;
  const errors = [];
  for (const r of races) {
    let f = cache[cacheKey(r)];
    const stale = !f || Date.now() - f.at > TTL_MS;
    if (stale && apiKey && used < budget && r.date >= todayLocal()) {
      used++;
      try {
        f = await findOfficialWeb(r, { apiKey, model, force: true });
      } catch (e) {
        errors.push(`${r.name}: ${e.message}`);
        if (/cuota/i.test(e.message)) budget = used; // cortar si se agota la cuota
      }
    }
    out.push(applyWebFinding(r, f));
  }
  return { races: out, checked: used, errors };
}
