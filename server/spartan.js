// Fuente Spartan (OCR): API pública del buscador de es.spartan.com.
// Incluye Spartan Race (Sprint/Super/Beast/Ultra), Spartan Trail, Tough Mudder y DEKA.
const API = 'https://api-gate.eks.spartan.com/one/v2/races/upcoming';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Origin: 'https://es.spartan.com',
  Referer: 'https://es.spartan.com/',
};

// Distancias oficiales de cada formato
const FORMAT_KM = {
  sprint: '5K',
  super: '10K',
  beast: '21K',
  ultra: '50K',
  'trail 10k': '10K',
  'trail 21k': '21K',
  'trail 50k': '50K',
  '5k': '5K',
  '10k': '10K',
  '21k': '21K',
};

const COUNTRIES = (process.env.SPARTAN_COUNTRIES || 'ES,AD').split(',').map((c) => c.trim().toUpperCase());

function discipline(brand = '', name = '') {
  const b = `${brand} ${name}`.toLowerCase();
  if (/trail/.test(b) && !/obstacle/.test(b)) return 'Trail running';
  return 'OCR / Obstáculos'; // Spartan, Tough Mudder, DEKA
}

function distanceLabels(categories = []) {
  const out = [];
  for (const c of categories) {
    const k = c.toLowerCase();
    if (/kid|niñ|team/.test(k)) continue;
    out.push(FORMAT_KM[k] ? `${c} ${FORMAT_KM[k]}` : c);
  }
  return [...new Set(out)];
}

export function mapSpartanRace(r) {
  const v = r.venue || {};
  const detail = r.alt_page_url || `https://es.spartan.com/es/race/detail/${r.id}/overview`;
  const labels = distanceLabels(r.categories);
  const brand = r.brand === 'Obstacle Course Races' ? 'Spartan Race' : r.brand || 'Spartan';
  return {
    id: `spartan-${r.id}`,
    source: 'spartan',
    name: r.name.replace(/\s+/g, ' ').trim(),
    brand,
    date: r.start_date,
    endDate: r.end_date && r.end_date > r.start_date ? r.end_date : '', // fines de semana Spartan (sáb + dom)
    discipline: discipline(r.brand, r.name),
    location: [v.city, v.state].filter(Boolean).join(' (') + (v.city && v.state ? ')' : ''),
    country: (v.country || '').toUpperCase(),
    lat: v.latitude ? Number(v.latitude) : null,
    lon: v.longitude ? Number(v.longitude) : null,
    distanceText: labels.join(' / '),
    inscriptions: labels.map((l) => ({ label: l, url: detail, open: true, adult: true })),
    inscriptionsOpen: true,
    price: null,
    image: r.full_image_url || '',
    officialUrl: detail,
    registrationUrl: detail,
    link: detail,
  };
}

/**
 * Busca carreras en un radio grande alrededor de varios centros (península + Baleares).
 */
export async function scrapeSpartan({ centers } = {}) {
  const points = centers || [
    [40.4, -3.7, 450], // centro peninsular
    [41.6, 1.8, 250], // Cataluña / Andorra / Baleares
  ];
  const all = new Map();
  const errors = [];
  for (const [lat, lon, radius] of points) {
    const url = `${API}?per_page=500&units=miles&radius=${radius}&latitude=${lat}&longitude=${lon}`;
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      for (const r of data.resources || []) {
        const race = mapSpartanRace(r);
        if (COUNTRIES.includes(race.country)) all.set(race.id, race);
      }
    } catch (e) {
      errors.push(`spartan ${lat},${lon}: ${e.message}`);
    }
  }
  return { races: [...all.values()], errors };
}
