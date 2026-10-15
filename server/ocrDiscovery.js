// Otras carreras de obstáculos (Farinato, Bulldog, Survivor, Hyrox…) que no
// tienen una fuente estructurada: se descubren con Gemini + Google Search,
// se verifican abriendo su web y se guardan 7 días en caché.
import fs from 'node:fs';
import path from 'node:path';
import { todayLocal } from '../src/lib/raceDedupe.js';
import { callAI as callGemini } from './ai.js';
import { verifyUrl } from './webFinder.js';

const CACHE_FILE = path.resolve(process.cwd(), '.cache', 'ocr-discovery.json');
const TTL_MS = 7 * 24 * 36e5;

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

export async function discoverOcrRaces({ apiKey, model, force = false, region = 'España (prioridad Cataluña)' } = {}) {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.at < TTL_MS) return { races: cached.races, errors: [], cached: true };
  if (!apiKey) return { races: cached?.races || [], errors: [] };

  const today = todayLocal();
  const prompt = `Hoy es ${today}. Busca en Google el calendario de CARRERAS DE OBSTÁCULOS (OCR) y fitness racing en ${region} para los próximos 12 meses.
Incluye organizadores como Farinato Race, Bulldog Race, Survivor Race, Hyrox, Xtrem Race, Infierno Race, Bestial Race, Lobos Race, Hard Race, Iron Race, Gladiator Race, y cualquier otra OCR española.
NO incluyas Spartan Race, Spartan Trail, Tough Mudder ni DEKA (ya los tengo).
Solo eventos con fecha confirmada posterior a hoy. Usa solo URLs que hayas visto en los resultados.

Responde SOLO con JSON:
{"races":[{"name":"","brand":"","date":"YYYY-MM-DD","endDate":"YYYY-MM-DD si dura varios días o \"\"","city":"","province":"","distances":["5K","10K"],"officialUrl":"","registrationUrl":"","price":null}]}`;

  const { data } = await callGemini({ apiKey, model, prompt, search: true });
  const list = Array.isArray(data?.races) ? data.races : [];
  const races = [];
  for (const r of list.slice(0, 40)) {
    if (!r?.name || !/^\d{4}-\d{2}-\d{2}$/.test(r.date || '') || r.date < today) continue;
    if (/spartan|tough mudder|deka/i.test(`${r.name} ${r.brand}`)) continue;
    const v = r.officialUrl ? await verifyUrl(r.officialUrl, r) : null;
    const vr = r.registrationUrl ? await verifyUrl(r.registrationUrl, r) : null;
    const officialUrl = v?.ok ? v.finalUrl : '';
    const registrationUrl = vr?.ok ? vr.finalUrl : '';
    if (!officialUrl && !registrationUrl) continue; // sin web comprobable → se descarta
    const distances = (r.distances || []).map(String).filter(Boolean);
    races.push({
      id: `ocr-${slug(r.name)}-${r.date}`,
      source: 'ocr',
      name: r.name,
      brand: r.brand || '',
      date: r.date,
      endDate: /^\d{4}-\d{2}-\d{2}$/.test(r.endDate || '') && r.endDate > r.date ? r.endDate : '',
      discipline: /hyrox/i.test(r.name) ? 'OCR / Obstáculos' : 'OCR / Obstáculos',
      location: [r.city, r.province].filter(Boolean).join(' (') + (r.city && r.province ? ')' : ''),
      distanceText: distances.join(' / '),
      price: Number.isFinite(Number(r.price)) && r.price !== null ? Number(r.price) : null,
      image: '',
      officialUrl,
      registrationUrl,
      link: registrationUrl || officialUrl,
      webVerified: Boolean(v?.matches),
    });
  }
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ at: Date.now(), races }, null, 2));
  return { races, errors: [] };
}
