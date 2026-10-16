// Cliente mínimo de Supabase (Auth + REST) con fetch, sin dependencias.
// Configuración en .env:
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   (o la antigua anon key eyJ...)
// (vite.config.js las inyecta; por defecto usa supabase/config.js)
// Sin configurar, la app funciona igual en modo local (localStorage).

const URL_ = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SESSION_KEY = 'rch_supabase_session';

export const cloudEnabled = Boolean(URL_ && ANON);

// ---------- sesión ----------
function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}
function writeSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('auth:changed', { detail: s?.user || null }));
}
function toSession(data) {
  if (!data?.access_token) return null;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    user: data.user,
  };
}

export function getUser() {
  return readSession()?.user || null;
}

export function displayName(user = getUser()) {
  return user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';
}

async function authFetch(path, body, { method = 'POST', token } = {}) {
  const res = await fetch(`${URL_}/auth/v1${path}`, {
    method,
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(translateAuthError(data.error_description || data.msg || data.message || `Error ${res.status}`));
  return data;
}

function translateAuthError(msg) {
  const m = String(msg);
  if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Confirma tu email: revisa tu bandeja de entrada.';
  if (/already registered|already been registered/i.test(m)) return 'Ya existe una cuenta con ese email.';
  if (/password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Demasiados intentos. Espera un momento.';
  return m;
}

export async function signUp(email, password, name) {
  // el enlace de confirmación vuelve a la app (añade esta URL en Supabase → Auth → URL Configuration)
  const data = await authFetch(`/signup?redirect_to=${encodeURIComponent(`${location.origin}/login`)}`, {
    email,
    password,
    data: { display_name: name },
  });
  const s = toSession(data);
  if (s) writeSession(s);
  // si el proyecto exige confirmar el email, no hay sesión hasta confirmarlo
  return { session: s, needsConfirmation: !s };
}

export async function signIn(email, password) {
  const s = toSession(await authFetch('/token?grant_type=password', { email, password }));
  writeSession(s);
  return s;
}

export async function signOut() {
  const s = readSession();
  try {
    if (s) await authFetch('/logout', null, { token: s.access_token });
  } catch {
    /* ignore */
  }
  writeSession(null);
}

export async function sendPasswordReset(email) {
  // redirect_to va en la URL (no en el cuerpo), igual que en el registro
  await authFetch(`/recover?redirect_to=${encodeURIComponent(`${location.origin}/reset-password`)}`, { email });
}

export async function updatePassword(password, accessToken) {
  const token = accessToken || (await getAccessToken());
  const user = await authFetch('/user', { password }, { method: 'PUT', token });
  return user;
}

/** Tras pulsar el enlace del email (#access_token=…&type=recovery|signup) */
export function consumeAuthRedirect() {
  if (!location.hash.includes('access_token')) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  const s = toSession({
    access_token: p.get('access_token'),
    refresh_token: p.get('refresh_token'),
    expires_in: Number(p.get('expires_in') || 3600),
  });
  history.replaceState(null, '', location.pathname + location.search);
  return { session: s, type: p.get('type') };
}

export async function setSessionFromRedirect(s) {
  const user = await authFetch('/user', null, { method: 'GET', token: s.access_token });
  writeSession({ ...s, user });
  return user;
}

async function getAccessToken() {
  let s = readSession();
  if (!s) return null;
  if (s.expires_at - 60 < Date.now() / 1000) {
    try {
      s = toSession(await authFetch('/token?grant_type=refresh_token', { refresh_token: s.refresh_token }));
      writeSession(s);
    } catch {
      writeSession(null);
      return null;
    }
  }
  return s.access_token;
}

// ---------- datos (PostgREST) ----------
export async function rest(path, { method = 'GET', body, prefer } = {}) {
  const token = await getAccessToken();
  // Las claves nuevas (sb_publishable_…) no son JWT: solo se manda Authorization con la sesión del usuario
  const legacyJwt = ANON.startsWith('eyJ') ? ANON : null;
  const bearer = token || legacyJwt;
  const res = await fetch(`${URL_}/rest/v1${path}`, {
    method,
    headers: {
      apikey: ANON,
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
  return data;
}

export const rpc = (fn, args) => rest(`/rpc/${fn}`, { method: 'POST', body: args });

export const supabaseUrl = URL_;
