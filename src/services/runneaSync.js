// Cliente de sincronización (xipgroc + Spartan + OCR + runnea). Cadena de fallbacks:
//  1) /api/races/sync  → mini-backend de Vite (Node, sin CORS, con caché en disco)
//  2) /races.json      → último snapshot generado por `npm run sync`
//  3) se mantiene lo que ya hay en localStorage (nunca se borra el catálogo)
import { getRaces, mergeFromSource, setLastSync, getLastSync, setCoords } from './raceStore';
import { lookupPreset } from '@/lib/places';
import { api } from '@/lib/api';

const SOURCE_LABEL = {
  live: 'en directo',
  runnea: 'en directo',
  cache: 'caché local (< 12 h)',
  'stale-cache': 'última copia guardada (las webs no respondieron)',
  snapshot: 'snapshot public/races.json',
};
const SOURCES = ['xipgroc', 'spartan', 'ocr', 'runnea'];

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) throw new Error('Respuesta no JSON (¿servidor estático?)');
  return res.json();
}

export async function importRunneaRaces({ force = false } = {}) {
  let result = null;
  const errors = [];

  try {
    const data = await fetchJson(api(`/api/races/sync${force ? '?force=1' : ''}`));
    if (data.races?.length) result = data;
    if (data.errors?.length) errors.push(...data.errors);
  } catch (e) {
    errors.push(`API local: ${e.message}`);
  }

  if (!result) {
    try {
      const snap = await fetchJson(api(`/races.json?t=${Date.now()}`));
      if (snap.races?.length) result = { ...snap, source: 'snapshot' };
    } catch (e) {
      errors.push(`Snapshot: ${e.message}`);
    }
  }

  if (!result) {
    const current = getRaces() || [];
    return {
      ok: false,
      races: current,
      count: 0,
      message: 'No se pudo contactar con las webs de carreras ni hay copia guardada. Se mantiene el catálogo actual.',
      errors,
    };
  }

  const withPreset = result.races.map((r) => ({ ...r, ...(r.lat == null && !r.locationUnknown ? lookupPreset(r.location) || {} : {}) }));
  let races = getRaces() || [];
  for (const src of SOURCES) {
    const items = withPreset.filter((r) => (r.source || 'runnea') === src);
    // solo se reemplaza una fuente si ha traído datos (si falla, se conserva lo anterior)
    if (items.length) races = mergeFromSource(src, items);
  }
  const bySource = SOURCES.map((s) => [s, withPreset.filter((r) => (r.source || 'runnea') === s).length])
    .filter(([, n]) => n)
    .map(([s, n]) => `${s} ${n}`)
    .join(' · ');
  setLastSync();
  // completar coordenadas pendientes en segundo plano
  resolveMissingCoords().catch(() => {});

  return {
    ok: true,
    races,
    count: result.races.length,
    source: result.source,
    fetchedAt: result.fetchedAt,
    message: `${result.races.length} carreras (${bySource}) · ${SOURCE_LABEL[result.source] || result.source}.`,
    errors,
  };
}

/** Sincroniza solo si han pasado más de `hours` horas desde la última vez. */
export function autoSyncIfStale(hours = 12) {
  if (Date.now() - getLastSync() < hours * 36e5) return Promise.resolve(null);
  return importRunneaRaces();
}

let resolving = false;
/** Pide al backend coordenadas para las ubicaciones sin lat/lon (por lotes, respetando Nominatim). */
export async function resolveMissingCoords(maxRounds = 6) {
  if (resolving) return;
  resolving = true;
  try {
    for (let i = 0; i < maxRounds; i++) {
      const pending = [
        ...new Set((getRaces() || []).filter((r) => r.lat == null && r.location && !r.locationUnknown).map((r) => r.geoQuery || r.location)),
      ];
      if (!pending.length) return;
      const coords = await fetchJson(api('/api/geocode'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: pending }),
      });
      const resolved = Object.fromEntries(Object.entries(coords).filter(([, v]) => v));
      if (!Object.keys(resolved).length) return; // sin progreso
      setCoords(resolved);
    }
  } finally {
    resolving = false;
  }
}
