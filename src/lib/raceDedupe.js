// Fechas locales y eliminación de duplicados entre fuentes.
// Se usa tanto en el servidor (Node) como en la app (navegador).

/** 'YYYY-MM-DD' en la zona horaria local (no UTC: a las 00:30 en Madrid sigue siendo "hoy"). */
export function todayLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return todayLocal(d);
}

export function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);
}

/** Una carrera es "pasada" cuando su último día ya ha terminado. */
export function isPast(race, today = todayLocal()) {
  const last = race.endDate || race.date;
  return Boolean(last) && last < today;
}

const STOP = new Set(
  (
    'cursa carrera carreras cros cross popular populars de del dels la el les els i y a the en per ' +
    'running run race edicio edicion edición edició km k weekend fin semana spartan oficial ' +
    'internacional nacional solidaria solidària memorial trofeu trofeo'
  ).split(/\s+/)
);

function tokens(name = '') {
  return new Set(
    String(name)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\b(19|20)\d{2}\b/g, ' ')
      .replace(/\b\d+(a|e|o|ª|º|è|ena|na|th)?\b/g, ' ') // ordinales "32a", "17è"
      .replace(/\b[ivxlc]+\b/g, ' ') // romanos "XLV"
      .replace(/\bmitja\b/g, 'media')
      .replace(/\bmarato\b/g, 'maraton')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

export function nameSimilarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((t) => B.has(t) && inter++);
  return inter / Math.min(A.size, B.size);
}

function urlKey(u) {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase();
  } catch {
    return '';
  }
}

/** ¿Son la misma carrera? (mismo evento con ±2 días, por nombre o por web oficial) */
export function sameRace(a, b) {
  if (a === b) return false;
  const dd = Math.abs(daysBetween(a.date, b.date));
  if (dd > 2) return false;
  const ua = urlKey(a.officialUrl);
  if (ua && ua.length > 8 && ua === urlKey(b.officialUrl)) return true;
  const sim = nameSimilarity(a.name, b.name);
  return dd === 0 ? sim >= 0.5 : sim >= 0.75;
}

// Prioridad de fuentes cuando hay duplicados (menor = gana)
const PRIORITY = { manual: 0, ai: 1, xipgroc: 2, spartan: 3, ocr: 4, runnea: 5 };
// ejemplos de versiones antiguas: nunca deben ganar a una fuente real
const LEGACY_SEEDS = new Set(['spartan-bcn-2026', 'mitja-terrassa-2027']);
const prio = (r) => (r.seed || LEGACY_SEEDS.has(r.id) ? 9 : PRIORITY[r.source] ?? 6);

/**
 * Elimina duplicados conservando la mejor fuente y completando los datos que
 * falten (ubicación, coordenadas, web, precio) con los de las otras copias.
 */
export function dedupeRaces(races) {
  const sorted = [...races].sort((a, b) => prio(a) - prio(b));
  const kept = [];
  for (const r of sorted) {
    const twin = kept.find((k) => sameRace(k, r));
    if (!twin) {
      kept.push({ ...r });
      continue;
    }
    if ((twin.lat == null || twin.locationUnknown || twin.locationGuessed) && r.lat != null && !r.locationUnknown) {
      Object.assign(twin, { lat: r.lat, lon: r.lon, location: r.location });
      delete twin.locationUnknown;
      delete twin.locationGuessed;
      delete twin.geoQuery;
    }
    if (!twin.officialUrl && r.officialUrl) twin.officialUrl = r.officialUrl;
    if (!twin.endDate && r.endDate && r.endDate > twin.date) twin.endDate = r.endDate;
    if (twin.price == null && r.price != null) twin.price = r.price;
    if (!twin.distanceText && r.distanceText) twin.distanceText = r.distanceText;
    if ((!twin.image || /unsplash/.test(twin.image)) && r.image && !/unsplash/.test(r.image)) twin.image = r.image;
    twin.alsoIn = [...new Set([...(twin.alsoIn || []), r.source].filter(Boolean))];
  }
  return kept;
}
