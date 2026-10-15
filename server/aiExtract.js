// Ingesta de fichas de carrera con Google Gemini (capa gratuita de Google AI Studio).
// Se ejecuta en el servidor de Vite: la API key no viaja al navegador si está en .env
import { detectDiscipline } from './runnea.js';
import { geocode } from './geocode.js';
import { todayLocal } from '../src/lib/raceDedupe.js';
import { callAI as callGemini } from './ai.js';
import { verifyUrl } from './webFinder.js';

const DISCIPLINES = ['OCR / Obstáculos', 'Trail running', 'Media maratón', 'Asfalto'];

const PAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,ca;q=0.8',
};

// Extrae lo útil de una web: metadatos OG, JSON-LD (schema.org/Event) y texto visible.
export function htmlToText(html = '') {
  const meta = [];
  const metaRe = /<meta[^>]+(?:property|name)="(og:[^"]+|description|twitter:[^"]+)"[^>]+content="([^"]*)"/gi;
  let m;
  while ((m = metaRe.exec(html))) meta.push(`${m[1]}: ${m[2]}`);

  const jsonLd = [];
  const ldRe = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = ldRe.exec(html))) jsonLd.push(m[1].trim().slice(0, 3000));

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

  return [
    meta.length ? `METADATOS:\n${meta.join('\n')}` : '',
    jsonLd.length ? `JSON-LD:\n${jsonLd.join('\n')}` : '',
    `TEXTO:\n${text}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function fetchPageText(url) {
  const res = await fetch(url, { headers: PAGE_HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`No se pudo leer la web (HTTP ${res.status})`);
  const html = await res.text();
  const ogImage = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i.exec(html)?.[1] || '';
  return { text: htmlToText(html), ogImage };
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    discipline: { type: 'STRING', enum: DISCIPLINES },
    date: { type: 'STRING', description: 'YYYY-MM-DD; primer día de la próxima edición' },
    endDate: { type: 'STRING', description: 'YYYY-MM-DD; último día si dura varios días (fin de semana, etapas), si no ""' },
    location: { type: 'STRING', description: 'Municipio (Provincia)' },
    distanceText: { type: 'STRING', description: 'Distancias disponibles, ej. "10 km / 21,1 km"' },
    price: { type: 'NUMBER', nullable: true, description: 'Precio mínimo de inscripción en euros' },
    link: { type: 'STRING', description: 'URL de inscripción o web oficial' },
    image: { type: 'STRING' },
    description: { type: 'STRING', description: 'Resumen de 1-2 frases' },
  },
  required: ['name', 'discipline', 'date', 'location'],
};

export async function extractRace({ url, text, query, apiKey, model }) {
  let content = (text || '').trim();
  let ogImage = '';
  if (url && !content) {
    const page = await fetchPageText(url);
    content = page.text;
    ogImage = page.ogImage;
  }
  const searchMode = !content && Boolean(query?.trim());
  if (!content && !searchMode) throw new Error('No hay contenido que analizar.');

  const today = todayLocal();
  const fields = `{"name":"","discipline":"${DISCIPLINES.join('|')}","date":"YYYY-MM-DD","endDate":"YYYY-MM-DD o \"\" si es de un día","location":"Municipio (Provincia)","distanceText":"","price":null,"link":"","officialUrl":"","registrationUrl":"","image":"","description":""}`;
  const prompt = searchMode
    ? `Eres un asistente que crea fichas de carreras populares (running, trail, OCR) en España.
Hoy es ${today}. Busca en Google la PRÓXIMA edición de: "${query.trim()}".
- Usa la web oficial del organizador (no agregadores como runnea o finishers) para fecha, distancias y precio.
- officialUrl: web oficial actual; registrationUrl: página de inscripción; link: la de inscripción si existe, si no la oficial.
- "discipline" exactamente uno de: ${DISCIPLINES.join(' | ')}. "price": precio más barato en euros o null.
- No inventes URLs: solo las que aparezcan en los resultados.
Responde SOLO con este JSON: ${fields}`
    : `Eres un asistente que crea fichas de competiciones deportivas (running, trail, OCR) en España.
Hoy es ${today}. Analiza el contenido y devuelve la ficha de la PRÓXIMA edición.
- Si solo hay día y mes, deduce el año más próximo a partir de hoy.
- "discipline" debe ser exactamente uno de: ${DISCIPLINES.join(' | ')}.
- "price": precio más barato en euros como número, o null si no aparece.
- No inventes enlaces: usa solo URLs presentes en el contenido${url ? ` o la URL de origen (${url})` : ''}.

CONTENIDO:
${content.slice(0, 15000)}`;

  const { data: race, sources, model: modelName } = await callGemini({
    apiKey,
    model,
    prompt,
    schema: searchMode ? undefined : RESPONSE_SCHEMA,
    search: searchMode,
  });

  // Normalización y validación
  if (!DISCIPLINES.includes(race.discipline)) race.discipline = detectDiscipline(race.name || '', race.distanceText || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(race.date || '')) race.date = '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(race.endDate || '') || race.endDate <= race.date) race.endDate = '';
  if (!race.link && url) race.link = url;
  if (!race.image && ogImage) race.image = ogImage;
  if (typeof race.price !== 'number') {
    const p = parseFloat(String(race.price ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
    race.price = Number.isFinite(p) ? p : null;
  }

  // En modo búsqueda, comprobar que las webs existen de verdad
  if (searchMode) {
    for (const k of ['officialUrl', 'registrationUrl', 'link']) {
      if (race[k]) {
        const v = await verifyUrl(race[k], race);
        race[k] = v.ok ? v.finalUrl : '';
      }
    }
    race.link = race.registrationUrl || race.officialUrl || race.link || '';
  }

  // Preferimos coordenadas reales de OSM a las que "recuerda" el modelo
  const geo = await geocode(race.location).catch(() => null);
  if (geo) {
    race.lat = geo.lat;
    race.lon = geo.lon;
  }
  return { ...race, source: 'ai', model: modelName, sources };
}
