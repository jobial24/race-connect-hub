// Categorías del calendario: Ciudad (asfalto) / Trail / Obstáculos,
// y dentro de cada una, tramos de distancia.

export const CATEGORIES = [
  { id: 'all', label: 'Todas' },
  { id: 'city', label: 'Ciudad', hint: 'asfalto' },
  { id: 'trail', label: 'Trail running', hint: 'montaña' },
  { id: 'ocr', label: 'Obstáculos', hint: 'OCR' },
];

// Tramos por categoría (km). Una carrera entra si ALGUNA de sus distancias cae en el tramo.
export const DISTANCE_BUCKETS = {
  city: [
    { id: 'all', label: 'Todas las distancias' },
    { id: '5k', label: '5K', min: 3, max: 7.5 },
    { id: '10k', label: '10K', min: 7.5, max: 15 },
    { id: 'half', label: 'Media maratón', min: 15, max: 30 },
    { id: 'marathon', label: 'Maratón', min: 30, max: 45 },
  ],
  trail: [
    { id: 'all', label: 'Todas las distancias' },
    { id: 'short', label: 'Corto (< 21 km)', min: 0, max: 21 },
    { id: 'mid', label: 'Medio (21–42 km)', min: 21, max: 40 },
    { id: 'marathon', label: 'Maratón (40–50 km)', min: 40, max: 50 },
    { id: 'ultra', label: 'Ultra (> 50 km)', min: 50, max: Infinity },
  ],
  ocr: [
    { id: 'all', label: 'Todas las distancias' },
    { id: 'sprint', label: 'Sprint (≤ 7 km)', min: 0, max: 7 },
    { id: 'super', label: 'Super (7–15 km)', min: 7, max: 15 },
    { id: 'beast', label: 'Beast (> 15 km)', min: 15, max: Infinity },
  ],
};

export function categoryOf(race) {
  switch (race.discipline) {
    case 'Trail running':
      return 'trail';
    case 'OCR / Obstáculos':
      return 'ocr';
    default:
      return 'city'; // Asfalto, Media maratón, sin clasificar
  }
}

const norm = (s = '') =>
  s.toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Extrae todas las distancias (km) de "21k y 10k", "10 km / 21,1 km", "42.195 km",
 * "800 m", y del nombre ("Media Maratón", "Marató", "10K"…).
 */
export function parseDistancesKm(race) {
  const out = new Set();
  const text = norm(`${race.distanceText || ''}`);
  const re = /(\d+(?:[.,]\d+)?)\s*(km|k|kms|m|metros)\b/g;
  let m;
  while ((m = re.exec(text))) {
    let raw = m[1];
    // "42.195" / "21.097" = decimales a la inglesa; "1.000 m" = miles
    let n = Number(raw.replace(',', '.'));
    const unit = m[2];
    if (unit === 'm' || unit === 'metros') {
      n = Number(raw.replace(/[.,]/g, '')) / 1000;
    }
    if (Number.isFinite(n) && n > 0 && n < 400) out.add(Math.round(n * 10) / 10);
  }

  const name = norm(race.name);
  if (/\b(media|mitja|half)\s*(maraton|marato|marathon)\b|\b21\s?k\b/.test(name)) out.add(21.1);
  else if (/\b(maraton|marato|marathon)\b/.test(name)) out.add(42.2);
  for (const k of name.matchAll(/\b(\d{1,3})\s?(?:k|km)\b/g)) out.add(Number(k[1]));
  if (/\bultra\b/.test(name)) out.add(60);

  return [...out].sort((a, b) => a - b);
}

export function matchesBucket(race, category, bucketId) {
  if (!bucketId || bucketId === 'all') return true;
  const bucket = DISTANCE_BUCKETS[category]?.find((b) => b.id === bucketId);
  if (!bucket) return true;
  return parseDistancesKm(race).some((d) => d >= bucket.min && d < bucket.max);
}
