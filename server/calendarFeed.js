// Calendario suscribible: /api/calendar/<token>.ics
// Google Calendar / Apple / Outlook lo vuelven a leer solos cada pocas horas,
// así las carreras nuevas aparecen sin hacer nada. Lee de Supabase (función
// calendar_feed, que solo devuelve las inscripciones del dueño del token).
import { buildIcs } from '../src/lib/ics.js';

export async function calendarFeed(token, env = process.env) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return buildIcs([], { name: 'Race Connect (sin base de datos configurada)' });

  const res = await fetch(`${url}/rest/v1/rpc/calendar_feed`, {
    method: 'POST',
    headers: {
      apikey: key,
      ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token: token }),
  });
  if (!res.ok) return buildIcs([], { name: 'Race Connect' });
  const rows = await res.json();
  return buildIcs(Array.isArray(rows) ? rows : []);
}
