// Zonas geográficas para el filtro País → Comunidad → Provincia → Municipio.
// De momento España (+ Andorra, por las carreras de montaña de Spartan);
// para añadir otro país basta con añadir su entrada en COUNTRIES.
import { normalizePlace } from './places.js';

// [provincia, comunidad, lat, lon] de la capital de provincia
const ES_PROVINCES = [
  ['Almería', 'Andalucía', 36.834, -2.464], ['Cádiz', 'Andalucía', 36.527, -6.289], ['Córdoba', 'Andalucía', 37.888, -4.779],
  ['Granada', 'Andalucía', 37.177, -3.599], ['Huelva', 'Andalucía', 37.261, -6.945], ['Jaén', 'Andalucía', 37.779, -3.785],
  ['Málaga', 'Andalucía', 36.721, -4.421], ['Sevilla', 'Andalucía', 37.389, -5.984],
  ['Huesca', 'Aragón', 42.136, -0.408], ['Teruel', 'Aragón', 40.345, -1.106], ['Zaragoza', 'Aragón', 41.649, -0.889],
  ['Asturias', 'Asturias', 43.361, -5.849],
  ['Illes Balears', 'Illes Balears', 39.570, 2.650],
  ['Las Palmas', 'Canarias', 28.124, -15.430], ['Santa Cruz de Tenerife', 'Canarias', 28.464, -16.252],
  ['Cantabria', 'Cantabria', 43.462, -3.810],
  ['Albacete', 'Castilla-La Mancha', 38.994, -1.858], ['Ciudad Real', 'Castilla-La Mancha', 38.986, -3.927],
  ['Cuenca', 'Castilla-La Mancha', 40.070, -2.137], ['Guadalajara', 'Castilla-La Mancha', 40.632, -3.166],
  ['Toledo', 'Castilla-La Mancha', 39.862, -4.027],
  ['Ávila', 'Castilla y León', 40.656, -4.700], ['Burgos', 'Castilla y León', 42.343, -3.697], ['León', 'Castilla y León', 42.599, -5.567],
  ['Palencia', 'Castilla y León', 42.010, -4.528], ['Salamanca', 'Castilla y León', 40.970, -5.664], ['Segovia', 'Castilla y León', 40.943, -4.109],
  ['Soria', 'Castilla y León', 41.764, -2.464], ['Valladolid', 'Castilla y León', 41.652, -4.724], ['Zamora', 'Castilla y León', 41.503, -5.744],
  ['Barcelona', 'Cataluña', 41.385, 2.173], ['Girona', 'Cataluña', 41.979, 2.821], ['Lleida', 'Cataluña', 41.618, 0.620],
  ['Tarragona', 'Cataluña', 41.119, 1.245],
  ['Alicante', 'Comunidad Valenciana', 38.345, -0.481], ['Castellón', 'Comunidad Valenciana', 39.986, -0.051],
  ['Valencia', 'Comunidad Valenciana', 39.470, -0.376],
  ['Badajoz', 'Extremadura', 38.879, -6.970], ['Cáceres', 'Extremadura', 39.475, -6.372],
  ['A Coruña', 'Galicia', 43.362, -8.411], ['Lugo', 'Galicia', 43.012, -7.556], ['Ourense', 'Galicia', 42.336, -7.864],
  ['Pontevedra', 'Galicia', 42.431, -8.644],
  ['Madrid', 'Comunidad de Madrid', 40.417, -3.704],
  ['Murcia', 'Región de Murcia', 37.992, -1.131],
  ['Navarra', 'Navarra', 42.812, -1.646],
  ['Álava', 'País Vasco', 42.847, -2.672], ['Gipuzkoa', 'País Vasco', 43.318, -1.981], ['Bizkaia', 'País Vasco', 43.263, -2.935],
  ['La Rioja', 'La Rioja', 42.465, -2.445],
  ['Ceuta', 'Ceuta', 35.889, -5.321], ['Melilla', 'Melilla', 35.292, -2.938],
];

// Nombres alternativos que aparecen en las webs (runnea, xipgroc, OSM…)
const ALIASES = {
  vizcaya: 'Bizkaia', biscay: 'Bizkaia', guipuzcoa: 'Gipuzkoa', 'guipúzcoa': 'Gipuzkoa', araba: 'Álava', alava: 'Álava',
  baleares: 'Illes Balears', 'islas baleares': 'Illes Balears', mallorca: 'Illes Balears', ibiza: 'Illes Balears', menorca: 'Illes Balears',
  'la coruna': 'A Coruña', coruna: 'A Coruña', 'la coruña': 'A Coruña', orense: 'Ourense', gerona: 'Girona', lerida: 'Lleida',
  castello: 'Castellón', 'castellon de la plana': 'Castellón', alacant: 'Alicante', valencia: 'Valencia', 'tenerife': 'Santa Cruz de Tenerife',
  'gran canaria': 'Las Palmas', oviedo: 'Asturias', santander: 'Cantabria', pamplona: 'Navarra', logrono: 'La Rioja',
  bilbao: 'Bizkaia', 'san sebastian': 'Gipuzkoa', donostia: 'Gipuzkoa', vitoria: 'Álava',
};

const REGION_ALIASES = {
  catalunya: 'Cataluña', catalonia: 'Cataluña', 'comunitat valenciana': 'Comunidad Valenciana', 'valencian community': 'Comunidad Valenciana',
  'balearic islands': 'Illes Balears', 'islas baleares': 'Illes Balears', 'euskadi': 'País Vasco', 'basque country': 'País Vasco',
  'comunidad foral de navarra': 'Navarra', 'principado de asturias': 'Asturias', 'region de murcia': 'Región de Murcia',
  'canary islands': 'Canarias', 'castile and leon': 'Castilla y León', 'castilla - la mancha': 'Castilla-La Mancha',
  'community of madrid': 'Comunidad de Madrid', madrid: 'Comunidad de Madrid', galiza: 'Galicia', andalusia: 'Andalucía',
};

export const COUNTRIES = {
  ES: { name: 'España', flag: '🇪🇸', provinces: ES_PROVINCES },
  AD: { name: 'Andorra', flag: '🇦🇩', provinces: [['Andorra', 'Andorra', 42.507, 1.522]] },
};

const PROV_BY_NORM = new Map();
for (const [code, c] of Object.entries(COUNTRIES)) {
  for (const p of c.provinces) PROV_BY_NORM.set(normalizePlace(p[0]), { country: code, province: p[0], region: p[1] });
}
for (const [alias, prov] of Object.entries(ALIASES)) {
  const hit = PROV_BY_NORM.get(normalizePlace(prov));
  if (hit) PROV_BY_NORM.set(normalizePlace(alias), hit);
}

function provinceFromText(text = '') {
  const n = normalizePlace(text);
  // "Terrassa (Barcelona)" → mira primero lo que va entre paréntesis
  const paren = /\(([^)]+)\)/.exec(n)?.[1];
  for (const cand of [paren, n].filter(Boolean)) {
    if (PROV_BY_NORM.has(cand.trim())) return PROV_BY_NORM.get(cand.trim());
  }
  return null;
}

function nearestProvince(lat, lon, countryCode) {
  let best = null;
  for (const [code, c] of Object.entries(COUNTRIES)) {
    if (countryCode && code !== countryCode) continue;
    for (const [province, region, plat, plon] of c.provinces) {
      const d = (lat - plat) ** 2 + ((lon - plon) * Math.cos((lat * Math.PI) / 180)) ** 2;
      if (!best || d < best.d) best = { d, country: code, province, region };
    }
  }
  // ~1,3° (≈140 km) como máximo: más lejos no es fiable
  return best && best.d < 1.8 ? best : null;
}

/** Municipio "limpio": "Terrassa (Barcelona)" → "Terrassa" */
export function municipalityOf(location = '') {
  const m = location.split(/[(,]/)[0].trim();
  if (!m || /^(catalunya|cataluña|españa|spain)$/i.test(m)) return '';
  return m;
}

/**
 * Zona de una carrera: { country, region, province, municipality }.
 * Orden de preferencia: datos de OpenStreetMap → texto de la ubicación → capital más cercana.
 */
export function zoneOf(race) {
  const country = (race.countryCode || race.country || 'ES').toString().toUpperCase().slice(0, 2);
  const cc = COUNTRIES[country] ? country : /andorra/i.test(race.country || race.location || '') ? 'AD' : 'ES';
  const municipality = race.locationUnknown ? '' : municipalityOf(race.location);
  if (cc === 'AD') return { country: 'AD', region: 'Andorra', province: 'Andorra', municipality };

  if (race.admin?.province || race.admin?.state) {
    const prov = provinceFromText(race.admin.province || '') || provinceFromText(race.admin.county || '');
    const region = REGION_ALIASES[normalizePlace(race.admin.state || '')] || race.admin.state;
    if (prov) return { country: prov.country, region: prov.region, province: prov.province, municipality };
    if (region) return { country: cc, region, province: '', municipality };
  }
  const byText = provinceFromText(race.location) || provinceFromText(race.region || '');
  if (byText) return { country: byText.country, region: byText.region, province: byText.province, municipality };
  if (Number.isFinite(race.lat) && Number.isFinite(race.lon)) {
    const near = nearestProvince(race.lat, race.lon, cc);
    if (near) return { country: near.country, region: near.region, province: near.province, municipality };
  }
  // xipgroc (Championchip) solo publica carreras de Cataluña
  if (race.source === 'xipgroc' || /catalunya|cataluña/i.test(race.location || '')) {
    return { country: 'ES', region: 'Cataluña', province: '', municipality };
  }
  return { country: cc, region: '', province: '', municipality };
}

/** Cuenta carreras por cada nivel para pintar los selectores con números. */
export function zoneTree(races) {
  const tree = {};
  for (const r of races) {
    const z = r.zone || zoneOf(r);
    const c = (tree[z.country] ||= { count: 0, regions: {} });
    c.count++;
    if (!z.region) continue;
    const reg = (c.regions[z.region] ||= { count: 0, provinces: {} });
    reg.count++;
    if (!z.province) continue;
    const p = (reg.provinces[z.province] ||= { count: 0, towns: {} });
    p.count++;
    if (z.municipality) p.towns[z.municipality] = (p.towns[z.municipality] || 0) + 1;
  }
  return tree;
}

export function matchesZone(race, sel) {
  if (!sel?.country) return true;
  const z = race.zone || zoneOf(race);
  if (z.country !== sel.country) return false;
  if (sel.region && z.region !== sel.region) return false;
  if (sel.province && z.province !== sel.province) return false;
  if (sel.municipality && z.municipality !== sel.municipality) return false;
  return true;
}
