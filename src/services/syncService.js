// Lista de fuentes por defecto a monitorizar
export const DEFAULT_SOURCES = [
  {
    url: 'https://es.spartan.com/es/races/barcelona',
    defaultDiscipline: 'OCR / Obstáculos',
    defaultLocation: 'Súria / Barcelona',
    defaultPrice: 95
  },
  {
    url: 'https://mitjaterrassa.cat',
    defaultDiscipline: 'Media maratón',
    defaultLocation: 'Terrassa',
    defaultPrice: 24
  },
  {
    url: 'https://www.cursadelscassos.cat',
    defaultDiscipline: 'Trail running',
    defaultLocation: 'Cataluña',
    defaultPrice: 18
  }
];

// Helper para parsear una URL individual vía proxy CORS
async function parseRemoteRace(source) {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(source.url)}`;
    const res = await fetch(proxyUrl);
    const data = await res.json();
    if (!data.contents) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(data.contents, 'text/html');

    const getMeta = (prop) =>
      doc.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ||
      doc.querySelector(`meta[name="${prop}"]`)?.getAttribute('content') || '';

    const title = getMeta('og:title') || doc.querySelector('title')?.innerText || '';
    const image = getMeta('og:image') || '';

    if (!title) return null;

    // Intentar deducir año / fecha próxima o asignar fecha estimada
    const today = new Date();
    const futureDate = new Date(today.setMonth(today.getMonth() + 2)).toISOString().split('T')[0];

    return {
      id: btoa(source.url).replace(/=/g, '').slice(-12),
      name: title.trim().slice(0, 70),
      discipline: source.defaultDiscipline || 'Asfalto',
      price: source.defaultPrice || 25,
      date: futureDate,
      location: source.defaultLocation || 'Cataluña',
      image: image.startsWith('http') ? image : 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80',
      link: source.url,
      lastSynced: new Date().toISOString()
    };
  } catch (err) {
    console.warn(`Error sincronizando ${source.url}:`, err);
    return null;
  }
}

// Ejecuta la sincronización completa cruzando datos con los existentes
export async function runFullSync(onProgress) {
  const sourcesStored = localStorage.getItem('race_connect_sources');
  const sources = sourcesStored ? JSON.parse(sourcesStored) : DEFAULT_SOURCES;

  const currentRacesStored = localStorage.getItem('race_connect_races');
  let currentRaces = currentRacesStored ? JSON.parse(currentRacesStored) : [];

  let count = 0;
  for (const src of sources) {
    if (onProgress) onProgress(count, sources.length, src.url);
    const fetchedRace = await parseRemoteRace(src);
    if (fetchedRace) {
      const idx = currentRaces.findIndex(r => r.link === fetchedRace.link || r.id === fetchedRace.id);
      if (idx >= 0) {
        currentRaces[idx] = { ...currentRaces[idx], ...fetchedRace };
      } else {
        currentRaces.unshift(fetchedRace);
      }
    }
    count++;
  }

  localStorage.setItem('race_connect_races', JSON.stringify(currentRaces));
  localStorage.setItem('race_connect_last_sync_timestamp', Date.now().toString());
  if (onProgress) onProgress(sources.length, sources.length, 'Completado');

  return currentRaces;
}

// Auto-sincronización silenciosa en background si ha pasado más de 12 horas
export function checkAndAutoSync(hoursThreshold = 12) {
  const lastSync = localStorage.getItem('race_connect_last_sync_timestamp');
  const now = Date.now();
  const thresholdMs = hoursThreshold * 60 * 60 * 1000;

  if (!lastSync || (now - Number(lastSync)) > thresholdMs) {
    runFullSync().catch(() => {});
  }
}