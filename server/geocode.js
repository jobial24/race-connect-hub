// Geocodificación gratuita con OpenStreetMap (Nominatim) + caché en disco.
// Política de uso de Nominatim: máx. 1 petición/segundo y User-Agent identificable.
import fs from 'node:fs';
import path from 'node:path';
import { lookupPreset, normalizePlace } from '../src/lib/places.js';

const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'geocode.json');
let cache = null;
let lastCall = 0;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatim(q) {
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=es,ad&accept-language=es&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'race-connect-hub/1.0 (local app)' } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = await res.json();
  if (!data[0]) return null;
  const a = data[0].address || {};
  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
    // para el filtro País → Comunidad → Provincia
    admin: { state: a.state || '', province: a.province || a.state_district || '', county: a.county || '', countryCode: (a.country_code || '').toUpperCase() },
  };
}

/** Devuelve {lat, lon} o null. `allowNetwork=false` solo usa caché/presets. */
export async function geocode(location, { allowNetwork = true } = {}) {
  const key = normalizePlace(location);
  if (!key) return null;
  const c = load();
  if (key in c) return c[key];

  const preset = lookupPreset(location);
  if (preset) {
    c[key] = preset;
    persist();
    return preset;
  }
  if (!allowNetwork) return undefined; // desconocido aún

  // "Terrassa (Barcelona)" → probar completo y luego solo la primera parte
  const candidates = [location, location.split(/[(,]/)[0]].map((s) => s.trim()).filter(Boolean);
  let found = null;
  for (const q of [...new Set(candidates)]) {
    try {
      found = await nominatim(q);
    } catch {
      return undefined; // error de red: no cachear
    }
    if (found) break;
  }
  c[key] = found; // null también se cachea para no repetir
  persist();
  return found;
}

/** Geocodifica una lista de ubicaciones, con límite de llamadas de red. */
export async function geocodeMany(locations, maxNetwork = 10) {
  const out = {};
  let used = 0;
  for (const loc of [...new Set(locations)]) {
    let r = await geocode(loc, { allowNetwork: false });
    if (r === undefined && used < maxNetwork) {
      used++;
      r = await geocode(loc, { allowNetwork: true });
    }
    if (r !== undefined) out[loc] = r;
  }
  return out;
}
