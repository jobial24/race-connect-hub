// Coordenadas de referencia (compartido entre el navegador y el servidor de Vite).
// Sirve para el selector manual de ciudad y como geocodificación instantánea
// antes de recurrir a OpenStreetMap (Nominatim).

export const PRESET_LOCATIONS = {
  Terrassa: { lat: 41.5632, lon: 2.0089 },
  Sabadell: { lat: 41.5463, lon: 2.1086 },
  Barcelona: { lat: 41.3851, lon: 2.1734 },
  Manresa: { lat: 41.728, lon: 1.8264 },
  Girona: { lat: 41.9794, lon: 2.8214 },
  Tarragona: { lat: 41.1189, lon: 1.2445 },
  Lleida: { lat: 41.6176, lon: 0.62 },
  Reus: { lat: 41.1561, lon: 1.1069 },
  Mataró: { lat: 41.5381, lon: 2.4447 },
  Badalona: { lat: 41.4500, lon: 2.2474 },
  "L'Hospitalet de Llobregat": { lat: 41.3597, lon: 2.0997 },
  Granollers: { lat: 41.6079, lon: 2.2876 },
  Vic: { lat: 41.9301, lon: 2.2549 },
  Igualada: { lat: 41.5781, lon: 1.6172 },
  "Sant Cugat del Vallès": { lat: 41.4722, lon: 2.0864 },
  Rubí: { lat: 41.4933, lon: 2.0326 },
  Castelldefels: { lat: 41.2806, lon: 1.9767 },
  "Vilanova i la Geltrú": { lat: 41.2241, lon: 1.7256 },
  Sitges: { lat: 41.2372, lon: 1.8059 },
  Figueres: { lat: 42.2671, lon: 2.9606 },
  Olot: { lat: 42.1822, lon: 2.4890 },
  Berga: { lat: 42.1035, lon: 1.8456 },
  Súria: { lat: 41.8333, lon: 1.75 },
  Roses: { lat: 42.2620, lon: 3.1764 },
  Tortosa: { lat: 40.8125, lon: 0.5216 },
  Madrid: { lat: 40.4168, lon: -3.7038 },
  Valencia: { lat: 39.4699, lon: -0.3763 },
  Sevilla: { lat: 37.3891, lon: -5.9845 },
  Zaragoza: { lat: 41.6488, lon: -0.8891 },
  Bilbao: { lat: 43.263, lon: -2.935 },
  Málaga: { lat: 36.7213, lon: -4.4214 },
  Palma: { lat: 39.5696, lon: 2.6502 },
  "San Sebastián": { lat: 43.3183, lon: -1.9812 },
  Pamplona: { lat: 42.8125, lon: -1.6458 },
  Valladolid: { lat: 41.6523, lon: -4.7245 },
};

// Ciudades que aparecen en el selector de la home (orden de aparición)
export const SELECTABLE_CITIES = [
  'Terrassa', 'Sabadell', 'Barcelona', 'Manresa', 'Girona', 'Tarragona', 'Lleida',
  'Reus', 'Mataró', 'Granollers', 'Vic', 'Igualada', 'Sant Cugat del Vallès',
  'Madrid', 'Valencia', 'Zaragoza', 'Bilbao', 'Sevilla',
];

export function normalizePlace(str = '') {
  return str
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .trim();
}

// Limpia "Terrassa (Barcelona)" / "Les Comes, Súria" → término de búsqueda principal
export function placeQuery(location = '') {
  return location.replace(/\s+/g, ' ').trim();
}

// Nombre del municipio del diccionario que aparece en un texto (o null)
export function findPresetName(text = '') {
  const norm = normalizePlace(text);
  if (!norm) return null;
  let best = null;
  for (const name of Object.keys(PRESET_LOCATIONS)) {
    const n = normalizePlace(name);
    const re = new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\']/g, '\\$&')}([^a-z]|$)`);
    const m = re.exec(norm);
    if (!m) continue;
    const idx = m.index + m[1].length;
    if (!best || idx < best.idx || (idx === best.idx && n.length > best.n.length)) best = { n, idx, name };
  }
  return best ? best.name : null;
}

// Busca coincidencia en el diccionario sin red.
export function lookupPreset(location = '') {
  const norm = normalizePlace(location);
  if (!norm) return null;
  let best = null;
  for (const [name, coords] of Object.entries(PRESET_LOCATIONS)) {
    const n = normalizePlace(name);
    const re = new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\']/g, '\\$&')}([^a-z]|$)`);
    const m = re.exec(norm);
    if (!m) continue;
    const idx = m.index + m[1].length;
    // "Terrassa (Barcelona)" → gana el municipio que aparece primero; empate → el nombre más largo
    if (!best || idx < best.idx || (idx === best.idx && n.length > best.n.length)) best = { n, idx, coords };
  }
  return best ? { ...best.coords } : null;
}

// Fórmula de Haversine → km (entero) o null si faltan coordenadas
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const nums = [lat1, lon1, lat2, lon2].map(Number);
  if (nums.some((v) => !Number.isFinite(v))) return null;
  const [a1, o1, a2, o2] = nums;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(a2 - a1);
  const dLon = toRad(o2 - o1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
