// Fechas de carreras que pueden durar un día, un fin de semana o varios días.
import { daysBetween } from './raceDedupe.js';

const fmt = (iso, opts) => {
  const t = new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', opts).replace(/,/g, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Número de días del evento (1 si es de un solo día). */
export function eventDays(race) {
  if (!race?.date || !race.endDate || race.endDate <= race.date) return 1;
  return daysBetween(race.date, race.endDate) + 1;
}

/** ¿Ocupa sábado y domingo? */
export function isWeekend(race) {
  if (eventDays(race) < 2) return false;
  const d = new Date(`${race.date}T12:00:00`);
  const e = new Date(`${race.endDate}T12:00:00`);
  return (d.getDay() === 6 || d.getDay() === 5) && e.getDay() === 0;
}

/** "Sáb, 17 oct 2026" o "Sáb 17 – Dom 18 oct 2026" / "30 oct – 2 nov 2026" */
export function formatRange(race, { long = false } = {}) {
  if (!race?.date) return 'Fecha por confirmar';
  const n = eventDays(race);
  if (n === 1) {
    return fmt(race.date, long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  const a = new Date(`${race.date}T12:00:00`);
  const b = new Date(`${race.endDate}T12:00:00`);
  const sameMonth = a.getMonth() === b.getMonth();
  const wd = long ? 'long' : 'short';
  const left = fmt(race.date, sameMonth ? { weekday: wd, day: 'numeric' } : { weekday: wd, day: 'numeric', month: long ? 'long' : 'short' });
  const right = fmt(race.endDate, { weekday: wd, day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' });
  return `${left} – ${right}`;
}

/** Etiqueta corta para la tarjeta: "Fin de semana", "3 días"… (o null si es de un día). */
export function durationLabel(race) {
  const n = eventDays(race);
  if (n < 2) return null;
  return isWeekend(race) && n <= 3 ? 'Fin de semana' : `${n} días`;
}

/** Lista de días del evento ['2026-10-17', '2026-10-18'] (máx. 10). */
export function eventDayList(race) {
  const out = [];
  if (!race?.date) return out;
  const n = Math.min(eventDays(race), 10);
  const d = new Date(`${race.date}T12:00:00`);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const shortDay = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
