// Búsqueda inteligente: convierte texto libre ("trail cerca de terrassa noviembre",
// "10k este finde", "ocr cataluña") en filtros que se muestran como chips.
import { normalizePlace, PRESET_LOCATIONS, calculateDistanceKm } from './places.js';
import { COUNTRIES } from './regions.js';
import { categoryOf, parseDistancesKm } from './raceCategories.js';
import { todayLocal, addDays } from './raceDedupe.js';

export const EMPTY_FILTERS = { category: 'all', dist: null, when: null, place: null, text: '' };

export const CATEGORY_LABELS = { city: 'Ciudad', trail: 'Trail', ocr: 'Obstáculos' };

// ---------- Distancias ----------
export const DIST_PRESETS = {
  '5k': { id: '5k', label: '5K', min: 3, max: 7.5 },
  '10k': { id: '10k', label: '10K', min: 7.5, max: 15 },
  half: { id: 'half', label: 'Media maratón', min: 15, max: 30 },
  marathon: { id: 'marathon', label: 'Maratón', min: 30, max: 50 },
  ultra: { id: 'ultra', label: 'Ultra (+50 km)', min: 50, max: Infinity },
  trailShort: { id: 'trailShort', label: 'Menos de 21 km', min: 0, max: 21 },
  trailMid: { id: 'trailMid', label: '21–42 km', min: 21, max: 42 },
  sprint: { id: 'sprint', label: 'Sprint (≤ 7 km)', min: 0, max: 7 },
  super: { id: 'super', label: 'Super (7–15 km)', min: 7, max: 15 },
  beast: { id: 'beast', label: 'Beast (+15 km)', min: 15, max: Infinity },
};

/** Atajos de distancia que tienen sentido para cada tipo */
export const DIST_SHORTCUTS = {
  all: ['5k', '10k', 'half', 'marathon', 'ultra'],
  city: ['5k', '10k', 'half', 'marathon'],
  trail: ['trailShort', 'trailMid', 'marathon', 'ultra'],
  ocr: ['sprint', 'super', 'beast'],
};

// ---------- Fechas ----------
const MONTHS = [
  ['enero', 'gener', 'january', 'ene'], ['febrero', 'febrer', 'february', 'feb'], ['marzo', 'marc', 'march', 'mar'],
  ['abril', 'april', 'abr'], ['mayo', 'maig', 'may'], ['junio', 'juny', 'june', 'jun'], ['julio', 'juliol', 'july', 'jul'],
  ['agosto', 'agost', 'august', 'ago'], ['septiembre', 'setiembre', 'setembre', 'september', 'sep', 'sept'],
  ['octubre', 'october', 'oct'], ['noviembre', 'novembre', 'november', 'nov'], ['diciembre', 'desembre', 'december', 'dic'],
];
const MONTH_LABEL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();

function weekend(offsetWeeks = 0, today = todayLocal()) {
  const d = new Date(`${today}T12:00:00`);
  const dow = d.getDay(); // 0 dom … 6 sáb
  // Si hoy es sábado o domingo, "este finde" es el actual
  const toSat = dow === 0 ? -1 : 6 - dow;
  const sat = addDays(today, toSat + offsetWeeks * 7);
  return { from: dow === 0 && offsetWeeks === 0 ? today : sat, to: addDays(sat, 1) };
}

export function whenPreset(id, today = todayLocal()) {
  const d = new Date(`${today}T12:00:00`);
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (id) {
    case 'today':
      return { id, label: 'Hoy', from: today, to: today };
    case 'weekend':
      return { id, label: 'Este finde', ...weekend(0, today) };
    case 'nextWeekend':
      return { id, label: 'Próximo finde', ...weekend(1, today) };
    case 'week': {
      const dow = (d.getDay() + 6) % 7; // lunes = 0
      return { id, label: 'Esta semana', from: today, to: addDays(today, 6 - dow) };
    }
    case 'month':
      return { id, label: 'Este mes', from: today, to: iso(new Date(y, m, lastDay(y, m))) };
    case 'nextMonth': {
      const nm = new Date(y, m + 1, 1);
      return { id, label: MONTH_LABEL[nm.getMonth()], from: iso(nm), to: iso(new Date(nm.getFullYear(), nm.getMonth(), lastDay(nm.getFullYear(), nm.getMonth()))) };
    }
    case '30d':
      return { id, label: 'Próximos 30 días', from: today, to: addDays(today, 30) };
    case '90d':
      return { id, label: 'Próximos 3 meses', from: today, to: addDays(today, 90) };
    default:
      return null;
  }
}

function monthRange(monthIdx, today = todayLocal(), year) {
  const t = new Date(`${today}T12:00:00`);
  let y = year || t.getFullYear();
  if (!year && monthIdx < t.getMonth()) y += 1; // "marzo" en octubre → marzo del año que viene
  const from = iso(new Date(y, monthIdx, 1));
  return {
    id: `m-${y}-${monthIdx}`,
    label: `${MONTH_LABEL[monthIdx]}${y !== t.getFullYear() ? ` ${y}` : ''}`,
    from: from < today ? today : from,
    to: iso(new Date(y, monthIdx, lastDay(y, monthIdx))),
  };
}

// ---------- Índice de lugares (comunidades, provincias, municipios con carreras) ----------
export function buildPlaceIndex(races) {
  const out = new Map(); // norm → place
  const add = (key, place) => {
    const n = normalizePlace(key);
    if (n.length >= 3 && !out.has(n)) out.set(n, place);
  };
  // municipios: coordenadas medias de sus carreras
  const towns = new Map();
  for (const r of races) {
    const z = r.zone;
    if (!z?.municipality) continue;
    const t = towns.get(z.municipality) || { n: 0, lat: 0, lon: 0, count: 0, zone: z };
    t.count++;
    if (Number.isFinite(r.lat) && Number.isFinite(r.lon)) {
      t.n++;
      t.lat += r.lat;
      t.lon += r.lon;
    }
    towns.set(z.municipality, t);
  }
  const regions = new Set();
  for (const [code, c] of Object.entries(COUNTRIES)) {
    add(c.name, { kind: 'zone', label: c.name, zone: { country: code }, type: 'País' });
    for (const [prov, region, lat, lon] of c.provinces) {
      if (!regions.has(region)) {
        regions.add(region);
        add(region, { kind: 'zone', label: region, zone: { country: code, region }, type: 'Comunidad' });
      }
      const pv = { kind: 'zone', label: `${prov} (provincia)`, zone: { country: code, region, province: prov }, type: 'Provincia', lat, lon };
      add(prov, pv);
      add(`provincia de ${prov}`, pv);
      add(`${prov} provincia`, pv);
      add(`provincia ${prov}`, pv);
    }
  }
  add('Catalunya', out.get('cataluna'));
  add('Euskadi', out.get('pais vasco'));
  add('Comunitat Valenciana', out.get('comunidad valenciana'));
  // los municipios pisan a la provincia homónima ("Barcelona" → cerca de Barcelona ciudad)
  for (const [name, t] of towns) {
    const preset = PRESET_LOCATIONS[name];
    const lat = preset?.lat ?? (t.n ? t.lat / t.n : null);
    const lon = preset?.lon ?? (t.n ? t.lon / t.n : null);
    out.set(normalizePlace(name), lat != null
      ? { kind: 'near', label: name, lat, lon, radius: 20, type: 'Municipio', count: t.count }
      : { kind: 'zone', label: name, zone: { ...t.zone }, type: 'Municipio', count: t.count });
  }
  for (const [name, c] of Object.entries(PRESET_LOCATIONS)) {
    if (!out.has(normalizePlace(name)) || out.get(normalizePlace(name)).type === 'Provincia') {
      out.set(normalizePlace(name), { kind: 'near', label: name, lat: c.lat, lon: c.lon, radius: 20, type: 'Municipio' });
    }
  }
  return out;
}

const STOP = new Set(['de', 'del', 'la', 'el', 'las', 'los', 'en', 'a', 'al', 'y', 'i', 'por', 'para', 'con', 'que', 'un', 'una',
  'carrera', 'carreras', 'cursa', 'curses', 'race', 'races', 'quiero', 'busco', 'hay', 'algo', 'para', 'correr', 'proximas', 'proxima']);

/**
 * Interpreta el texto y devuelve los filtros reconocidos (solo los campos encontrados).
 * @returns {{category?, dist?, when?, place?, nearMe?, text: string}}
 */
export function parseQuery(input, placeIndex, today = todayLocal()) {
  let s = ` ${normalizePlace(input).replace(/[.,;!?¿¡]/g, ' ').replace(/\s+/g, ' ')} `;
  const found = {};
  const take = (re, fn) => {
    const m = re.exec(s);
    if (!m) return false;
    const r = fn(m);
    if (r === false) return false;
    s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
    return true;
  };

  // Radio: "a 30 km", "a menos de 30 km", "radio 30"
  let radius = null;
  take(/ (?:a menos de|a|radio(?: de)?|en un radio de) (\d{1,3}) ?(?:km|kms|kilometros)? /, (m) => { radius = Number(m[1]); });

  // Cerca de mí
  if (take(/ (?:cerca de mi|cerca mio|cerca de casa|a prop meu|a prop de casa|aqui cerca|near me) /, () => {})) found.nearMe = true;

  // Tipo
  take(/ (trail|trails|montana|montanya|muntanya|mountain|ultra trail|skyrace|sky race|vertical|km vertical) /, () => { found.category = 'trail'; });
  take(/ (ocr|obstaculos|obstacles|obstacle|spartan|tough mudder|deka|hyrox|mud|barro) /, () => { found.category = 'ocr'; });
  take(/ (ciudad|asfalto|asfalt|urbana|urbanas|ruta|road) /, () => { found.category = 'city'; });

  // Distancia
  take(/ (media maraton|media|mitja marato|mitja|half marathon|half|21k|21 k|21 km|21,1 km|21\.1 km) /, () => { found.dist = DIST_PRESETS.half; });
  take(/ (maraton|marato|marathon|42k|42 km) /, () => { found.dist = DIST_PRESETS.marathon; });
  take(/ (ultra|ultras) /, () => { found.dist = DIST_PRESETS.ultra; if (!found.category) found.category = 'trail'; });
  take(/ (sprint|super|beast) /, (m) => { found.dist = DIST_PRESETS[m[1]]; found.category = 'ocr'; });
  take(/ (\d{1,3}) ?(?:k|km|kms) /, (m) => {
    const n = Number(m[1]);
    if (n === 5) found.dist = DIST_PRESETS['5k'];
    else if (n === 10) found.dist = DIST_PRESETS['10k'];
    else found.dist = { id: `${n}k`, label: `~${n} km`, min: n * 0.85, max: n * 1.15 };
  });

  // Fecha
  const presets = [
    [/ (hoy|avui) /, 'today'],
    [/ (este (?:finde|fin de semana)|aquest cap de setmana|finde|fin de semana|weekend) /, 'weekend'],
    [/ ((?:proximo|siguiente|el otro) (?:finde|fin de semana)|el finde que viene|proper cap de setmana) /, 'nextWeekend'],
    [/ (esta semana|aquesta setmana) /, 'week'],
    [/ (este mes|aquest mes) /, 'month'],
    [/ ((?:proximo|siguiente) mes|el mes que viene|mes que viene|proper mes) /, 'nextMonth'],
    [/ (proximos 30 dias|este mes y el siguiente) /, '30d'],
  ];
  // primero los más específicos ("próximo finde" antes que "finde")
  for (const [re, id] of [presets[2], presets[5], presets[0], presets[1], presets[3], presets[4], presets[6]]) {
    if (take(re, () => { found.when = whenPreset(id, today); })) break;
  }
  if (!found.when) {
    for (let i = 0; i < 12 && !found.when; i++) {
      const names = MONTHS[i].filter((n) => n.length > 3 || ['ene', 'feb', 'abr', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'].includes(n));
      const re = new RegExp(` (?:en |de |el mes de )?(${names.join('|')})(?: (?:de |del )?(20\\d\\d))? `);
      take(re, (m) => { found.when = monthRange(i, today, m[2] ? Number(m[2]) : undefined); });
    }
  }

  // Año suelto: "2027"
  if (!found.when) {
    take(/ (?:en |del? )?(20\d\d) /, (m) => {
      const y = Number(m[1]);
      if (y < Number(today.slice(0, 4))) return false;
      found.when = { id: `y-${y}`, label: String(y), from: `${y}-01-01` < today ? today : `${y}-01-01`, to: `${y}-12-31` };
    });
  }

  // Lugar: probar n-gramas de más largo a más corto
  const words = s.trim().split(' ').filter(Boolean);
  if (placeIndex) {
    outer: for (let len = Math.min(5, words.length); len >= 1; len--) {
      for (let i = 0; i + len <= words.length; i++) {
        const gram = words.slice(i, i + len).join(' ');
        const hit = placeIndex.get(gram) || placeIndex.get(gram.replace(/^(cerca de|cerca|en|por|desde|de) /, ''));
        if (hit && !STOP.has(gram)) {
          // ¿iba precedido de "cerca de"? → siempre por cercanía
          const before = words.slice(Math.max(0, i - 2), i).join(' ');
          const near = /cerca( de)?$|prop de$/.test(before);
          let place = { ...hit };
          if (near && hit.lat != null) place = { kind: 'near', label: hit.label.replace(' (provincia)', ''), lat: hit.lat, lon: hit.lon, radius: radius || 30, type: hit.type };
          if (place.kind === 'near' && radius) place.radius = radius;
          found.place = place;
          words.splice(near ? i - (before.endsWith('de') ? 2 : 1) : i, len + (near ? (before.endsWith('de') ? 2 : 1) : 0));
          break outer;
        }
      }
    }
  }
  // "cerca" suelto (sin lugar detrás) = cerca de mí
  if (!found.place && words.includes('cerca')) found.nearMe = true;
  if (found.nearMe && found.place) delete found.nearMe; // "cerca de terrassa" ya es un lugar
  if (radius && !found.place) found.radius = radius;

  found.text = words.filter((w) => !STOP.has(w) && !/^(cerca|de|mi|mes)$/.test(w)).join(' ');
  return found;
}

/** Aplica lo interpretado sobre los filtros actuales (lo nuevo sustituye a lo anterior). */
export function mergeParsed(filters, parsed, origin) {
  const next = { ...filters };
  if (parsed.category) next.category = parsed.category;
  if (parsed.dist) next.dist = parsed.dist;
  if (parsed.when) next.when = parsed.when;
  if (parsed.place) next.place = parsed.place;
  else if (parsed.nearMe || parsed.radius) next.place = { kind: 'near', origin: true, radius: parsed.radius || filters.place?.radius || 30 };
  next.text = parsed.text || '';
  return next;
}

// ---------- Filtrado ----------
const overlaps = (race, from, to) => {
  const start = race.date || '';
  const end = race.endDate || start;
  if (!start) return false;
  return start <= to && end >= from;
};

export function placeCenter(place, origin) {
  if (!place || place.kind !== 'near') return null;
  return place.origin ? { lat: origin.lat, lon: origin.lon } : { lat: place.lat, lon: place.lon };
}

export function matchesFilters(race, f, origin, { skip } = {}) {
  if (skip !== 'category' && f.category !== 'all' && categoryOf(race) !== f.category) return false;
  if (skip !== 'dist' && f.dist) {
    const ds = parseDistancesKm(race);
    if (!ds.some((d) => d >= (f.dist.min ?? 0) && d < (f.dist.max ?? Infinity))) return false;
  }
  if (skip !== 'when' && f.when && !overlaps(race, f.when.from, f.when.to)) return false;
  if (skip !== 'place' && f.place) {
    const p = f.place;
    if (p.kind === 'near') {
      const c = placeCenter(p, origin);
      const d = calculateDistanceKm(c.lat, c.lon, race.lat, race.lon);
      if (d == null || d > p.radius) return false;
    } else if (p.kind === 'zone') {
      const z = race.zone || {};
      const s = p.zone;
      if (s.country && z.country !== s.country) return false;
      if (s.region && z.region !== s.region) return false;
      if (s.province && z.province !== s.province) return false;
      if (s.municipality && z.municipality !== s.municipality) return false;
    } else if (p.kind === 'bounds') {
      const [south, west, north, east] = p.bounds;
      if (!Number.isFinite(race.lat) || race.lat < south || race.lat > north || race.lon < west || race.lon > east) return false;
    }
  }
  if (skip !== 'text' && f.text) {
    const hay = normalizePlace(`${race.name} ${race.location} ${race.distanceText || ''} ${race.discipline || ''}`);
    if (!f.text.split(' ').every((w) => hay.includes(w))) return false;
  }
  return true;
}

export function placeLabel(place, origin, { radius = true } = {}) {
  if (!place) return '';
  if (place.kind === 'near') {
    const base = place.origin ? `Cerca de ${origin?.mode === 'gps' ? 'ti' : origin?.name || 'ti'}` : `Cerca de ${place.label}`;
    return radius ? `${base} · ${place.radius} km` : base;
  }
  if (place.kind === 'bounds') return 'Zona del mapa';
  return place.label;
}

export const RADIUS_STEPS = [10, 20, 30, 50, 100, 200];
