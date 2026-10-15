// Asistente IA (Gemini, OpenAI o Claude) a través del mini-backend local.
// La API key vive SOLO en el servidor (Admin → Asistente IA o .env); el navegador
// nunca la envía.
export { calculateDistanceKm, PRESET_LOCATIONS } from '@/lib/places';
import { api } from '@/lib/api';

const KEY_STORAGE = 'race_connect_gemini_key';
const MODEL_STORAGE = 'race_connect_gemini_model';

export const DEFAULT_MODEL = '';

export function getAiSettings() {
  // versiones anteriores guardaban la key en el navegador: se elimina
  try {
    localStorage.removeItem(KEY_STORAGE);
    localStorage.removeItem(MODEL_STORAGE);
  } catch {
    /* ignore */
  }
  return { apiKey: '', model: '' };
}

export function saveAiSettings({ apiKey, model }) {
  try {
    apiKey ? localStorage.setItem(KEY_STORAGE, apiKey) : localStorage.removeItem(KEY_STORAGE);
    model ? localStorage.setItem(MODEL_STORAGE, model) : localStorage.removeItem(MODEL_STORAGE);
  } catch {
    /* ignore */
  }
}

// ---- Ajustes guardados en el servidor (no se pierden al cambiar de navegador) ----
export async function getServerSettings() {
  const res = await fetch(api('/api/settings'));
  if (!res.ok) throw new Error('El backend local no responde.');
  return res.json();
}

export async function saveServerSettings({ provider, apiKey, model }) {
  const res = await fetch(api('/api/settings'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, ...(apiKey ? { apiKey } : {}), model: model || '' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  // la key ya vive en el servidor: no mantener una copia antigua en el navegador
  saveAiSettings({ apiKey: '', model: '' });
  return data;
}

/** Prueba real contra la IA → { ok, model, provider } o { ok:false, error } */
export async function testAI({ provider, apiKey, model } = {}) {
  const res = await fetch(api('/api/ai/test'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, ...(apiKey ? { apiKey } : {}), ...(model ? { model } : {}) }),
  });
  return res.json().catch(() => ({ ok: false, error: 'El backend local no responde.' }));
}

export async function getServerStatus() {
  try {
    const res = await fetch(api('/api/health'));
    if (!res.ok) return { online: false, ai: false };
    const data = await res.json();
    return { online: true, ai: Boolean(data.ai), aiProvider: data.aiProvider, aiSource: data.aiSource };
  } catch {
    return { online: false, ai: false };
  }
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error('El backend local no responde. Arranca la app con "npm run dev".');
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/**
 * Busca con Gemini + Google Search la web oficial ACTUAL de una carrera
 * (y la verifica abriéndola). Devuelve la carrera actualizada o null si no hay cambios.
 */
export async function findOfficialWebAI(race, { force = false } = {}) {
  const { apiKey, model } = getAiSettings();
  const { finding } = await postJson(api('/api/ai/find-web'), {
    race: {
      id: race.id,
      name: race.name,
      date: race.date,
      location: race.location,
      link: race.link,
      officialUrl: race.officialUrl,
    },
    force,
    apiKey: apiKey || undefined,
    model: model || undefined,
  });
  return finding;
}

/** Aplica lo encontrado (misma regla que el servidor). */
export function applyWebFinding(race, f) {
  if (!f || (!f.officialUrl && !f.registrationUrl)) return race;
  if (!f.verified && f.confidence === 'baja') return race;
  const officialUrl = f.officialUrl || race.officialUrl || '';
  const registrationUrl = f.registrationUrl || race.registrationUrl || '';
  return {
    ...race,
    officialUrl,
    registrationUrl,
    link: registrationUrl || officialUrl || race.link,
    webCheckedAt: f.at,
    webVerified: f.verified,
    ...(race.price == null && f.price != null ? { price: f.price } : {}),
  };
}

/**
 * @param {{url?: string, text?: string, query?: string}} input
 * @returns ficha normalizada {name, discipline, date, location, distanceText, price, link, image, lat, lon, description}
 */
export async function extractRaceWithAI({ url, text, query }) {
  const { apiKey, model } = getAiSettings();
  const data = await postJson(api('/api/ai/extract'), {
    url,
    text,
    query,
    apiKey: apiKey || undefined,
    model: model || undefined,
  });
  return data.race;
}
