// Scraper de runnea.com que se ejecuta en Node (servidor de Vite o script de sync).
// Al correr en servidor no hay CORS, y se envían cabeceras de navegador real.

const BASE = 'https://www.runnea.com';
const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,ca;q=0.8,en;q=0.6',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://www.google.com/',
  'Upgrade-Insecure-Requests': '1',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toISO(dateStr) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec((dateStr || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function decodeEntities(s = '') {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function detectDiscipline(name = '', distText = '') {
  const n = name.toLowerCase();
  if (/spartan|ocr|obst[aá]cul|hyrox|farinera|xtrem|infierno|mud/.test(n)) return 'OCR / Obstáculos';
  if (/trail|muntanya|monta[ñn]a|ultra|skyrace|vertical|cims|serra/.test(n)) return 'Trail running';
  if (/media|mitja|half|21k|21 k/.test(n) || /\b21([.,]\d+)?\s*k/i.test(distText)) return 'Media maratón';
  return 'Asfalto';
}

// Misma lógica que la función ImportRaces de Base44, más robusta.
export function parseRunneaHtml(html) {
  const records = [];
  const seen = new Set();
  if (!html || !html.includes('card-races')) return records;

  // Se parsean todas las tarjetas (destacadas + listado); el Set evita duplicados.
  const blocks = html.split(/class="card card-races[^"]*"/).slice(1);

  for (const raw of blocks) {
    const block = raw.slice(0, 2500);
    const hrefM = block.match(/href="((?:https:\/\/www\.runnea\.com)?\/carreras-populares\/[^"#?]+)"/);
    if (!hrefM) continue;

    let href = hrefM[1];
    if (href.startsWith('/')) href = BASE + href;
    const slug = href.replace(/\/$/, '').split('/').pop();
    if (!slug || seen.has(slug)) continue;

    const dateM = block.match(/data date"[^>]*>\s*<td[^>]*>\s*(\d{2}-\d{2}-\d{4})\s*<\/td>/);
    const date = dateM ? toISO(dateM[1]) : null;
    if (!date) continue;
    seen.add(slug);

    const nameM = block.match(/title="([^"]+)"/);
    const imgM = block.match(/src="(https:\/\/static\.runnea\.com\/[^"]+)"/);
    const locM = block.match(/data location"[^>]*>\s*<td[^>]*>\s*([^<]*)\s*<\/td>/);
    const distM = block.match(/data distance"[^>]*>\s*<td[^>]*>\s*([^<]*)\s*<\/td>/);

    const name = decodeEntities(nameM ? nameM[1] : slug.replace(/-/g, ' ')).trim();
    const distanceText = decodeEntities(distM ? distM[1] : '').trim();
    const location = decodeEntities(locM ? locM[1] : '').trim() || 'España';

    records.push({
      id: `runnea-${slug}`,
      source: 'runnea',
      name,
      date,
      discipline: detectDiscipline(name, distanceText),
      location,
      distanceText,
      price: null, // runnea no publica precio en el listado
      image: imgM ? imgM[1] : FALLBACK_IMAGE,
      sourceUrl: href, // ficha de runnea: solo para leer datos, nunca se muestra
      link: '', // se rellena con la web oficial en runneaDetails.js
    });
  }
  return records;
}

async function fetchHtml(url, { retries = 2, timeoutMs = 15000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, signal: ctrl.signal, redirect: 'follow' });
      const body = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (/cf-chl|challenge-platform|Just a moment\.\.\./i.test(body) && !body.includes('card-races')) {
        throw new Error('Bloqueado por Cloudflare (challenge)');
      }
      return body;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(1500 * (attempt + 1));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

/**
 * Descarga y parsea uno o varios listados de runnea.
 * @param {string[]} paths  p.ej. ['/carreras-populares/', '/carreras-populares/cataluna/']
 * @param {number} maxPages páginas extra a intentar por listado (?page=N)
 */
export async function scrapeRunnea(paths = ['/carreras-populares/calendario/'], maxPages = 1) {
  const all = new Map();
  const errors = [];
  for (const p of paths) {
    for (let page = 1; page <= maxPages; page++) {
      const url = BASE + p + (page > 1 ? `?page=${page}` : '');
      try {
        const html = await fetchHtml(url);
        const recs = parseRunneaHtml(html);
        const before = all.size;
        recs.forEach((r) => all.set(r.id, r));
        if (all.size === before) break; // la paginación no trajo nada nuevo
      } catch (err) {
        errors.push(`${url}: ${err.message}`);
        break;
      }
      await sleep(800);
    }
  }
  return { races: [...all.values()], errors };
}
