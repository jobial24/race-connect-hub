// "Mis inscripciones": se guardan en este navegador (localStorage) y, si hay
// cuenta en Supabase, también en la nube (mismas carreras en el móvil y el PC).
import { getAiSettings } from './aiRaceService';
import { api } from '@/lib/api';
import { cloudEnabled, getUser, rest, rpc } from '@/lib/supabase';
import { buildIcs } from '@/lib/ics';

const KEY = 'race_connect_my_races';
const PENDING_KEY = 'race_connect_pending_signup';
const PENDING_TTL = 6 * 36e5; // 6 h para volver de la web de inscripción

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('myraces:updated'));
}

export function getMyRaces() {
  const list = read(KEY, []);
  // limpia el ejemplo ficticio de versiones anteriores
  return Array.isArray(list) ? list.filter((r) => r.raceId || r.createdAt) : [];
}

export function findSignup(raceId) {
  return getMyRaces().find((m) => m.raceId === raceId) || null;
}

/** Crea una inscripción a partir de una carrera del catálogo + datos extra. */
export function buildSignup(race, extra = {}) {
  return {
    id: extra.id || `ins-${Date.now()}`,
    raceId: race?.id || '',
    name: race?.name || extra.name || '',
    date: race?.date || extra.date || '',
    // eventos de varios días: por defecto todo el evento; el usuario puede elegir su día
    endDate: race?.endDate && race.endDate > race.date ? race.endDate : '',
    eventDate: race?.endDate ? race.date : '',
    eventEndDate: race?.endDate && race.endDate > race.date ? race.endDate : '',
    location: race?.location || extra.location || '',
    discipline: race?.discipline || '',
    image: race?.image || '',
    lat: race?.lat ?? null,
    lon: race?.lon ?? null,
    link: race?.officialUrl || race?.link || '',
    registrationUrl: extra.registrationUrl || race?.registrationUrl || '',
    distance: '',
    bib: '',
    price: race?.price ?? null,
    confirmationCode: '',
    startTime: race?.startTime || '',
    pickup: '',
    platform: race?.source === 'xipgroc' ? 'xipgroc' : '',
    goalTime: '',
    finishTime: '',
    notes: '',
    status: 'inscrito',
    isPublic: true, // aparece en "¿Quién va?"
    createdAt: Date.now(),
    ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== '')),
  };
}

export function saveSignup(entry) {
  const list = getMyRaces();
  const idx = list.findIndex((m) => m.id === entry.id || (entry.raceId && m.raceId === entry.raceId));
  let saved;
  if (idx >= 0) saved = list[idx] = { ...list[idx], ...entry, id: list[idx].id, updatedAt: Date.now() };
  else list.push((saved = { ...entry, updatedAt: Date.now() }));
  write(KEY, list);
  pushToCloud(saved).catch(() => {});
  return saved;
}

export function deleteSignup(id) {
  write(KEY, getMyRaces().filter((m) => m.id !== id));
  if (cloudEnabled && getUser()) rest(`/signups?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
}

// ---------- nube (Supabase) ----------
const toRow = (e) => ({
  id: e.id,
  race_id: e.raceId || null,
  race_date: e.date || null,
  is_public: e.isPublic !== false,
  data: e,
  updated_at: new Date(e.updatedAt || Date.now()).toISOString(),
});

async function pushToCloud(entry) {
  if (!cloudEnabled || !getUser() || !entry) return;
  await rest('/signups?on_conflict=user_id,id', {
    method: 'POST',
    body: [toRow(entry)],
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

/** Une lo local con lo de la nube (gana la versión más reciente) y sube lo que falte. */
export async function syncWithCloud() {
  if (!cloudEnabled || !getUser()) return { synced: false };
  const rows = (await rest('/signups?select=data,updated_at')) || [];
  const remote = new Map(rows.map((r) => [r.data.id, { ...r.data, updatedAt: Date.parse(r.updated_at) || r.data.updatedAt }]));
  const local = new Map(getMyRaces().map((m) => [m.id, m]));
  const merged = new Map(remote);
  const toPush = [];
  for (const [id, m] of local) {
    const r = remote.get(id);
    if (!r || (m.updatedAt || 0) > (r.updatedAt || 0)) {
      merged.set(id, m);
      toPush.push(m);
    }
  }
  write(KEY, [...merged.values()]);
  if (toPush.length) {
    await rest('/signups?on_conflict=user_id,id', {
      method: 'POST',
      body: toPush.map(toRow),
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }
  return { synced: true, count: merged.size, pushed: toPush.length };
}

/** Enlace secreto del calendario suscribible (Google/Apple/Outlook). */
export async function getCalendarFeedUrl() {
  if (!cloudEnabled || !getUser()) return null;
  const rows = await rest('/profiles?select=calendar_token');
  const token = rows?.[0]?.calendar_token;
  if (!token) return null;
  const base = (import.meta.env.VITE_API_BASE || location.origin).replace(/\/$/, '');
  return `${base}/api/calendar/${token}.ics`;
}

/** ¿Quién va? → { raceId: [{display_name, distance}] } (solo con cuenta) */
export async function getAttendees(raceIds) {
  if (!cloudEnabled || !getUser() || !raceIds.length) return {};
  const rows = (await rpc('race_attendees', { p_race_ids: raceIds.slice(0, 500) })) || [];
  const out = {};
  for (const r of rows) (out[r.race_id] ||= []).push(r);
  return out;
}

// ---------- detección al volver de la web de inscripción ----------
export function setPendingSignup(race, inscription) {
  write(PENDING_KEY, {
    raceId: race.id,
    distance: inscription?.label || '',
    url: inscription?.url || race.link || '',
    at: Date.now(),
  });
}
export function getPendingSignup() {
  const p = read(PENDING_KEY, null);
  if (!p || Date.now() - p.at > PENDING_TTL) return null;
  if (findSignup(p.raceId)) return null; // ya registrada
  return p;
}
export function clearPendingSignup() {
  write(PENDING_KEY, null);
}

// ---------- comprobante con IA ----------
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function parseReceiptAI({ text, file, candidates }) {
  const { apiKey, model } = getAiSettings();
  const payload = {
    text,
    candidates,
    apiKey: apiKey || undefined,
    model: model || undefined,
  };
  if (file) {
    if (file.size > 8 * 1024 * 1024) throw new Error('El archivo pesa más de 8 MB.');
    payload.file = { mimeType: file.type || 'application/pdf', data: await fileToBase64(file) };
  }
  const res = await fetch(api('/api/ai/parse-receipt'), {
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
  return data.receipt;
}

// ---------- calendario (.ics) ----------
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadIcs(entry) {
  if (!entry?.date) return;
  download(`${entry.name.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 50)}.ics`, buildIcs([entry], { name: entry.name }));
}

export function downloadAllIcs(entries = getMyRaces()) {
  download('mis-carreras.ics', buildIcs(entries));
}
