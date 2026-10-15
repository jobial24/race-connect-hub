// Enriquecimiento de cada carrera de runnea con datos de su ficha:
// la WEB OFICIAL de la carrera ("Ver web de la carrera"), el enlace de
// inscripción si aparece, y el municipio exacto (JSON-LD schema.org/Event).
// Así el usuario va directo a la web de la carrera, nunca a runnea.
import fs from 'node:fs';
import path from 'node:path';

const CACHE_FILE = path.resolve(process.cwd(), '.cache', 'runnea-details.json');
const TTL_MS = 7 * 24 * 36e5; // las fichas cambian poco: 7 días

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
};

// Dominios que nunca son "la web de la carrera"
const NOT_OFFICIAL =
  /runnea\.|gembiratech|facebook\.|instagram\.|twitter\.|x\.com|youtube\.|youtu\.be|tiktok\.|linkedin\.|whatsapp|pinterest|google\.|apple\.com|amazon\.|amzn\.|factorialhr/i;

// Plataformas de inscripción habituales en España
const REGISTRATION =
  /inscrip|registro|registration|xipgroc|championchip|rockthesport|sportmaniacs|championchip|youevent|eventbrite|timetosport|time-to-sport|crono|mychip|lleidaesport|runedia|sportsevents|trackingsport|bikeandrun|ticket|entradas/i;

const decode = (s = '') =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").trim();

export function parseRunneaDetail(html = '') {
  const body = html.slice(Math.max(0, html.indexOf('<body')));
  const anchors = [...body.matchAll(/<a\b([^>]*)>([\s\S]{0,200}?)<\/a>/gi)].map((m) => {
    const attrs = m[1];
    return {
      href: decode(/href="([^"]+)"/i.exec(attrs)?.[1] || ''),
      cls: /class="([^"]*)"/i.exec(attrs)?.[1] || '',
      text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    };
  });
  const external = anchors.filter((a) => /^https?:\/\//i.test(a.href) && !NOT_OFFICIAL.test(a.href));

  // 1) Botón "Ver web de la carrera" (clase in-card)
  const officialBtn =
    external.find((a) => /ver web de la carrera/i.test(a.text)) ||
    external.find((a) => /\bin-card\b/.test(a.cls));
  // 2) Enlace de inscripción dentro del texto (class="outlink")
  const registration = external.find(
    (a) => /\boutlink\b/.test(a.cls) && REGISTRATION.test(a.href)
  );

  // 3) JSON-LD Event → municipio y hora
  let locality = '';
  let region = '';
  let startDate = '';
  let endDate = '';
  let organizer = '';
  let country = '';
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const ev = [].concat(data).find((d) => d && d['@type'] === 'Event');
      if (!ev) continue;
      locality = ev.location?.address?.addressLocality || ev.location?.name || '';
      region = ev.location?.address?.addressRegion || '';
      startDate = ev.startDate || '';
      endDate = ev.endDate || '';
      organizer = ev.organizer?.name || '';
      const c = ev.location?.address?.addressCountry;
      country = (typeof c === 'string' ? c : c?.name || '').trim().toLowerCase();
      break;
    } catch {
      /* JSON-LD inválido: se ignora */
    }
  }

  const cap = (s) => s.replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  return {
    officialUrl: officialBtn?.href || '',
    registrationUrl: registration?.href || '',
    locality: locality.trim(),
    region: region ? cap(region.replace(/-/g, ' ')) : '',
    // runnea pone 01:00 / 00:00 cuando no conoce la hora
    startTime: (/T(\d{2}:\d{2})/.exec(startDate)?.[1] || '').replace(/^0[01]:00$/, ''),
    organizer: organizer.trim(),
    country, // 'espana', 'alemania'…
    // carreras de varios días (fin de semana, etapas…)
    endDate: /^\d{4}-\d{2}-\d{2}/.test(endDate) && endDate.slice(0, 10) > startDate.slice(0, 10) ? endDate.slice(0, 10) : '',
  };
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(c) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2));
}

async function fetchDetail(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseRunneaDetail(await res.text());
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Aplica los datos de la ficha a una carrera del listado. */
export function applyDetail(race, d) {
  if (!d) {
    // nunca mandar al usuario a runnea: si aún no tenemos la web oficial, sin enlace
    return race.link && /runnea\./.test(race.link)
      ? { ...race, sourceUrl: race.sourceUrl || race.link, link: '' }
      : race;
  }
  const location = d.locality
    ? d.region && d.region.toLowerCase() !== d.locality.toLowerCase()
      ? `${d.locality} (${d.region})`
      : d.locality
    : race.location;
  return {
    ...race,
    location,
    officialUrl: d.officialUrl || '',
    registrationUrl: d.registrationUrl || '',
    // el botón de la app lleva a la web de la carrera; runnea queda solo como referencia interna
    link: d.registrationUrl || d.officialUrl || '',
    startTime: d.startTime || race.startTime || '',
    organizer: d.organizer || race.organizer || '',
    country: d.country || race.country || '',
    ...(d.endDate && d.endDate > race.date ? { endDate: d.endDate } : {}),
  };
}

/**
 * Enriquece las carreras con su web oficial. Respeta una caché de 7 días y
 * un presupuesto de fichas nuevas por ejecución para no saturar runnea.
 */
export async function enrichWithDetails(races, { budget = 40, concurrency = 3 } = {}) {
  const cache = loadCache();
  const now = Date.now();
  races = races.map((r) =>
    !r.sourceUrl && /runnea\./.test(r.link || '') ? { ...r, sourceUrl: r.link } : r
  );
  const todo = races.filter((r) => {
    if (!r.sourceUrl) return false;
    const c = cache[r.sourceUrl];
    return !c || now - c.at > TTL_MS || !('country' in c); // fichas antiguas sin país → releer
  }).slice(0, budget);

  let i = 0;
  const errors = [];
  async function worker() {
    while (i < todo.length) {
      const r = todo[i++];
      try {
        cache[r.sourceUrl] = { at: Date.now(), ...(await fetchDetail(r.sourceUrl)) };
      } catch (e) {
        errors.push(`${r.sourceUrl}: ${e.message}`);
      }
      await sleep(400);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  if (todo.length) saveCache(cache);

  const pending = races.filter((r) => r.sourceUrl && !cache[r.sourceUrl]).length;
  return {
    races: races.map((r) => applyDetail(r, r.sourceUrl ? cache[r.sourceUrl] : null)),
    pending,
    errors,
  };
}
