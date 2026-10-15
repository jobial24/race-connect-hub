import { isPast, todayLocal } from '@/lib/raceDedupe';
// Almacén local de carreras (localStorage) con fusión inteligente por origen.
const KEY = 'race_connect_races';
const SYNC_KEY = 'race_connect_last_sync';

export const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80';

export function getRaces() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRaces(races) {
  try {
    localStorage.setItem(KEY, JSON.stringify(races));
  } catch (e) {
    console.warn('No se pudo guardar en localStorage', e);
  }
  window.dispatchEvent(new CustomEvent('races:updated'));
  return races;
}

export function getLastSync() {
  try {
    return Number(localStorage.getItem(SYNC_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function setLastSync(ts = Date.now()) {
  try {
    localStorage.setItem(SYNC_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

/**
 * Sustituye las carreras de una fuente (p. ej. 'runnea') por las nuevas,
 * conservando las manuales / de IA y las coordenadas ya resueltas.
 */
export function mergeFromSource(source, incoming) {
  const today = todayLocal();
  const current = (getRaces() || []).filter((r) => !isPast(r, today));
  incoming = incoming.filter((r) => !isPast(r, today));
  const prevById = new Map(current.map((r) => [r.id, r]));
  const fresh = incoming.map((r) => {
    const prev = prevById.get(r.id);
    const samePlace = prev && prev.location === r.location;
    return {
      ...r,
      source,
      lat: r.lat ?? (samePlace ? prev.lat : null) ?? null,
      lon: r.lon ?? (samePlace ? prev.lon : null) ?? null,
    };
  });
  const freshIds = new Set(fresh.map((r) => r.id));
  const freshLinks = new Set(fresh.map((r) => r.link).filter(Boolean));
  const keep = current.filter(
    (r) => r.source !== source && r.source !== undefined && !freshIds.has(r.id)
  );
  // carreras antiguas sin "source" (versiones previas): se conservan si no están duplicadas
  const legacy = current.filter(
    (r) =>
      r.source === undefined &&
      !freshIds.has(r.id) &&
      !freshLinks.has(r.link) &&
      !/runnea\./.test(r.link || '') // restos de versiones que enlazaban a runnea
  );
  return saveRaces([...keep, ...legacy, ...fresh]);
}

export function upsertRace(race) {
  const current = getRaces() || [];
  const idx = current.findIndex((r) => r.id === race.id || (race.link && r.link === race.link && r.link !== '#'));
  if (idx >= 0) current[idx] = { ...current[idx], ...race, id: current[idx].id };
  else current.unshift(race);
  return saveRaces([...current]);
}

export function deleteRace(id) {
  return saveRaces((getRaces() || []).filter((r) => r.id !== id));
}

export function setCoords(coordsByLocation) {
  const current = getRaces() || [];
  let changed = false;
  const updated = current.map((r) => {
    const c = coordsByLocation[r.geoQuery || r.location];
    if (c && (r.lat == null || r.lon == null)) {
      changed = true;
      return { ...r, lat: c.lat, lon: c.lon, ...(c.admin ? { admin: c.admin } : {}) };
    }
    return r;
  });
  return changed ? saveRaces(updated) : current;
}
