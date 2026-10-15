// Fuente xipgroc.cat (Championchip Catalunya): calendario de carreras catalanas
// con INSCRIPCIÓN DIRECTA por distancia. Se lee el listado mensual
// /cursas?q[data_gteq]=AAAA-MM-01&q[data_lteq]=AAAA-MM-DD (HTML renderizado en servidor).
import fs from 'node:fs';
import path from 'node:path';
import { lookupPreset, findPresetName } from '../src/lib/places.js';
import { callAI as callGemini } from './ai.js';
import { todayLocal } from '../src/lib/raceDedupe.js';

const BASE = 'https://xipgroc.cat';
const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=80';
const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const PRICE_CACHE = path.join(CACHE_DIR, 'xipgroc-prices.json');
const PLACE_CACHE = path.join(CACHE_DIR, 'xipgroc-places.json');

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'ca-ES,ca;q=0.9,es;q=0.8',
};

const MONTHS_CA = {
  gener: '01', febrer: '02', marc: '03', 'març': '03', abril: '04', maig: '05', juny: '06',
  juliol: '07', agost: '08', setembre: '09', octubre: '10', novembre: '11', desembre: '12',
};

// Icono del listado → tipo de prueba (se descartan natación, bici y multideporte)
const ICON_TYPE = { c: 'running', v: 'trail', '.': 'pista', n: 'swim', b: 'bike', w: 'multi' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s = '') =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

// "MITJA MARATÓ COSTA BARCELONA" → "Mitja Marató Costa Barcelona"
function prettyName(name) {
  const letters = name.replace(/[^\p{L}]/gu, '');
  const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
  if (!letters.length || upper / letters.length < 0.7) return name;
  return name
    .toLowerCase()
    .replace(/(^|[\s\-'’"(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
    .replace(/(?<=\s)(I|Y|De|Del|Dels|La|El|Les|Els|A|D'|D’|L'|L’)(?=\s|\p{L})/gu, (w) => w.toLowerCase())
    .replace(/(\d+)(Km|K)\b/g, (_, n, u) => n + u.toUpperCase());
}

function caDateToISO(text) {
  const m = /(\d{1,2})\s+([a-zàç]+)\s+(\d{4})/i.exec(text || '');
  if (!m) return null;
  const month = MONTHS_CA[m[2].toLowerCase()] || MONTHS_CA[m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')];
  return month ? `${m[3]}-${month}-${m[1].padStart(2, '0')}` : null;
}

function discipline(type, name) {
  if (type === 'trail') return 'Trail running';
  const n = name.toLowerCase();
  if (/spartan|obstacle|ocr|hyrox/.test(n)) return 'OCR / Obstáculos';
  if (/mitja|media|half/.test(n)) return 'Media maratón';
  return 'Asfalto';
}

// Intenta deducir el municipio del nombre, leyendo desde el final:
// "Cursa de la Dona - Corbera de Llobregat" → "Corbera de Llobregat"
// "17a Cursa Popular de Sant Vicenç dels Horts" → "Sant Vicenç dels Horts"
// "La Cursa de RAC1 Platja d’Aro" → "Platja d’Aro"
const RACE_WORDS = new Set(
  ('cursa carrera cros cross popular mitja marato marató maraton maratón trail milla milles nocturna nocturnes ' +
    'urbans urbana solidaria solidària caminada pujada baixada lliga ciutat dona festa volta running run race ' +
    'buff vinya vinya-cross solidari benefica benèfica malalties minoritaries minoritàries muntanya marxa night sant-silvestre silvestre')
    .split(/\s+/)
);
const GEO_WORDS = new Set(['pic', 'puig', 'serra', 'coll', 'turo', 'turó', 'mont', 'cim', 'cims', 'riu', 'pantà', 'panta']);
const CONNECTORS = new Set(['de', 'del', 'dels', 'la', 'el', 'les', 'els', 'i', "d'", 'd’', "l'", 'l’']);

export function guessPlaceFromName(name) {
  if (lookupPreset(name)) return null; // ya lo resuelve el diccionario
  const clean = name.replace(/["“”«»]/g, ' ').replace(/\s*\d{4}\s*$/, '');
  const tail = clean.split(/\s[-–—|:]\s|\s\+\s|,/).pop(); // lo que va tras " - "
  // separar "d’Aro" en "d’" + "Aro"
  const words = tail.replace(/\b([dl])['’](?=\p{Lu})/giu, '$1’ ').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    const lw = w.toLowerCase();
    if (CONNECTORS.has(lw)) {
      out.unshift(w); // se conserva la mayúscula: "Les Franqueses", "La Garriga"
      continue;
    }
    const plain = lw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (GEO_WORDS.has(plain)) return null; // "Pic del Vent" es un monte, no un municipio
    if (/^[IVXLC]+$/.test(w)) break; // ordinal romano
    if (/\d/.test(w) || RACE_WORDS.has(lw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) || RACE_WORDS.has(lw)) break;
    if (!/^\p{Lu}/u.test(w)) break;
    out.unshift(w);
  }
  // quitar conectores iniciales en minúscula ("de Sants" → "Sants"), pero no artículos de topónimo ("Les Franqueses")
  while (out.length && CONNECTORS.has(out[0].toLowerCase()) && !/^\p{Lu}/u.test(out[0])) out.shift();
  while (out.length && CONNECTORS.has(out[0].toLowerCase()) && !/^(La|El|Les|Els|L’|L')$/.test(out[0])) out.shift();
  const place = out.join(' ').replace(/([dl]’) /gi, '$1');
  return place.length > 2 ? place : null;
}

export function parseXipgrocList(html) {
  const races = [];
  for (const chunk of html.split('<article id=cursa_').slice(1)) {
    const block = chunk.split('</article>')[0];
    const id = /^(\d+)/.exec(block)?.[1];
    const icon = /<span class="icon">\s*(\S?)\s*<\/span>/.exec(block)?.[1];
    const type = ICON_TYPE[icon] || (/\btrail\b/.test(/^[^>]*/.exec(block)?.[0] || '') ? 'trail' : 'unknown');
    if (!id || ['swim', 'bike', 'multi'].includes(type)) continue; // solo carreras a pie

    const titleM = /class="title-link"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/.exec(block) ||
      /<h4>\s*(?:<a[^>]*href="([^"]*)"[^>]*>)?([^<]+)/.exec(block);
    const name = prettyName(decode(titleM?.[2] || ''));
    const date = caDateToISO(/<p>([^<]*\d{4})<\/p>/.exec(block)?.[1]);
    if (!name || !date) continue;
    const kind = type === 'unknown' ? (/trail|muntanya|marxa|cros|pujada|cims|serra/i.test(name) ? 'trail' : 'running') : type;

    const inscriptions = [];
    for (const a of block.matchAll(/<a\b([^>]*\binscripcio\b[^>]*)>([^<]*)<\/a>/g)) {
      const attrs = a[1];
      const href = decode(/href="([^"]+)"/.exec(attrs)?.[1] || '');
      // "12_3K" → "12,3K", "Caminada_Trail" → "Caminada Trail"
      const label = decode(a[2]).replace(/(\d)_(\d)/g, '$1,$2').replace(/_/g, ' ');
      if (!label) continue;
      inscriptions.push({
        label,
        url: !href ? '' : /^https?:/.test(href) ? href : BASE + href.replace(/[?&]layout=false/, ''),
        open: Boolean(href) && !/tancad/.test(attrs),
        // categorías infantiles / por edades / extras: no cuentan como distancia de la carrera
        adult: !/infantil|^sb\d|^mas\d|^vet|^sen|benjam|alev|cadet|preben|promoci|àpat|apat|dorsal|donaci|divercursa|adaptada|soroll/i.test(label),
      });
    }

    const img = /id=cursa_\d+_image type='hidden' value='([^']*)'/.exec(block)?.[1];
    const officialUrl = titleM?.[1] && /^https?:/.test(titleM[1]) ? decode(titleM[1]) : '';
    const adult = inscriptions.filter((i) => i.adult);
    const firstOpen = adult.find((i) => i.open) || inscriptions.find((i) => i.open);

    races.push({
      id: `xipgroc-${id}`,
      source: 'xipgroc',
      name,
      date,
      discipline: discipline(kind, name),
      location: '',
      distanceText: adult.map((i) => i.label).join(' / '),
      inscriptions: adult.length ? adult : inscriptions,
      inscriptionsOpen: Boolean(firstOpen),
      price: null,
      image: img ? BASE + img : FALLBACK_IMAGE,
      officialUrl,
      registrationUrl: firstOpen?.url || '',
      link: firstOpen?.url || officialUrl,
      sourceUrl: `${BASE}/ca/curses`,
    });
  }
  return races;
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function monthRanges(months) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    const from = i === 0 ? todayLocal() : first.toISOString().slice(0, 10);
    out.push([from, last.toISOString().slice(0, 10)]);
  }
  return out;
}

function readJson(f) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return {};
  }
}
function writeJson(f, d) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
}

// Precio: se lee de la página de inscripción ("Inscripció bàsica: 23€")
async function attachPrices(races, budget) {
  const cache = readJson(PRICE_CACHE);
  let used = 0;
  for (const r of races) {
    if (!r.registrationUrl) continue;
    if (!(r.registrationUrl in cache) && used < budget) {
      used++;
      try {
        const html = await fetchHtml(r.registrationUrl);
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        const m =
          /Inscripci[óo][^:€]{0,40}:\s*(\d+(?:[.,]\d{1,2})?)\s*€/i.exec(text) || /(\d+(?:[.,]\d{1,2})?)\s*€/.exec(text);
        cache[r.registrationUrl] = m ? Number(m[1].replace(',', '.')) : null;
      } catch {
        /* sin precio */
      }
      await sleep(300);
    }
    if (cache[r.registrationUrl] != null) r.price = cache[r.registrationUrl];
  }
  if (used) writeJson(PRICE_CACHE, cache);
  return races;
}

// Municipio: diccionario → patrón del nombre → (opcional) Gemini en un solo lote
async function attachPlaces(races, ai) {
  const cache = readJson(PLACE_CACHE);
  const unknown = [];
  for (const r of races) {
    if (cache[r.id]) {
      r.location = cache[r.id];
      continue;
    }
    const preset = findPresetName(r.name);
    if (preset) {
      r.location = preset;
      continue;
    }
    // con IA se pregunta el municipio real; sin IA, se deduce del nombre ("Cursa de Parets" → Parets)
    if (ai?.apiKey) unknown.push(r);
    const guess = guessPlaceFromName(r.name);
    if (guess) {
      r.location = guess;
      r.locationGuessed = true;
    }
    else if (!ai?.apiKey) unknown.push(r);
  }

  if (unknown.length && ai?.apiKey) {
    try {
      const list = unknown.slice(0, 60).map((r) => `${r.id} | ${r.name} | ${r.officialUrl}`).join('\n');
      const { data } = await callGemini({
        apiKey: ai.apiKey,
        model: ai.model,
        prompt: `Para cada carrera popular de Cataluña, indica el municipio donde se celebra (solo el nombre del municipio, en catalán). Usa el nombre y la web. Si no lo sabes, "".
Responde SOLO JSON: {"<id>":"<municipio>", ...}

${list}`,
        schema: undefined,
      });
      for (const r of unknown) if (data?.[r.id]) cache[r.id] = r.location = String(data[r.id]).trim();
      writeJson(PLACE_CACHE, cache);
    } catch {
      /* sin IA: se queda sin municipio */
    }
  }
  for (const r of races) {
    if (r.location) r.geoQuery = `${r.location}, Catalunya`; // evitar homónimos fuera de Cataluña
    if (!r.location) {
      r.location = 'Catalunya';
      r.locationUnknown = true; // no geocodificar: daría el centro de Cataluña
    }
  }
  return races;
}

/**
 * @returns {{races: object[], errors: string[]}}
 */
export async function scrapeXipgroc({ months = 6, priceBudget = 30, ai } = {}) {
  const all = new Map();
  const errors = [];
  for (const [from, to] of monthRanges(months)) {
    for (let page = 1; page <= 6; page++) {
      const url = `${BASE}/cursas?q[data_gteq]=${from}&q[data_lteq]=${to}&curses_view_type=big&result_preset=all&page=${page}`;
      try {
        const html = await fetchHtml(url);
        parseXipgrocList(html).forEach((r) => all.set(r.id, r));
        // ¿hay página siguiente? (will_paginate: <li class="next next_page ">, deshabilitada si es la última)
        if (!/class="next next_page\s*"/.test(html)) break;
      } catch (e) {
        errors.push(`xipgroc ${from} p${page}: ${e.message}`);
        break;
      }
      await sleep(500);
    }
  }
  let races = [...all.values()];
  races = await attachPlaces(races, ai);
  races = await attachPrices(races, priceBudget);
  return { races, errors };
}
