// Generación de calendarios (.ics) y enlaces "Añadir a Google / Outlook".
// Sin DOM: lo usan la app y el servidor (calendario suscribible).

const pad = (n) => String(n).padStart(2, '0');
const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');

function fold(line) {
  // RFC 5545: líneas de máx. 75 octetos
  const out = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

function nextDay(iso) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** Hora de inicio/fin (formato local) o día completo. */
function times(e) {
  const d = (e.date || '').replace(/-/g, '');
  const m = /^(\d{1,2}):(\d{2})/.exec(e.startTime || '');
  if (!m) return { allDay: true, start: d, end: e.endDate ? nextDay(e.endDate) : nextDay(e.date) };
  const h = Number(m[1]);
  return {
    allDay: false,
    start: `${d}T${pad(h)}${m[2]}00`,
    end: `${d}T${pad(Math.min(23, h + 3))}${m[2]}00`,
  };
}

export function describe(e) {
  return [
    e.distance && `Distancia: ${e.distance}`,
    e.bib && `Dorsal: ${e.bib}`,
    e.confirmationCode && `Código: ${e.confirmationCode}`,
    e.goalTime && `Objetivo: ${e.goalTime}`,
    e.pickup && `Recogida de dorsal: ${e.pickup}`,
    e.registrationUrl || e.link,
  ]
    .filter(Boolean)
    .join('\n');
}

export const title = (e) => `🏃 ${e.name}${e.distance ? ` (${e.distance})` : ''}`;

function vevent(e) {
  const t = times(e);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  return [
    'BEGIN:VEVENT',
    `UID:${e.id || e.raceId || e.name}@race-connect-hub`,
    `DTSTAMP:${stamp}`,
    t.allDay ? `DTSTART;VALUE=DATE:${t.start}` : `DTSTART;TZID=Europe/Madrid:${t.start}`,
    t.allDay ? `DTEND;VALUE=DATE:${t.end}` : `DTEND;TZID=Europe/Madrid:${t.end}`,
    `SUMMARY:${esc(title(e))}`,
    `LOCATION:${esc(e.location || '')}`,
    `DESCRIPTION:${esc(describe(e))}`,
    ...(e.registrationUrl || e.link ? [`URL:${e.registrationUrl || e.link}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`Mañana: ${e.name}`)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P7D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`En una semana: ${e.name}`)}`,
    'END:VALARM',
    'END:VEVENT',
  ];
}

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Madrid',
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
];

/** Calendario completo con una o varias carreras. */
export function buildIcs(entries, { name = 'Mis carreras · Race Connect' } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Race Connect Hub//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'X-WR-TIMEZONE:Europe/Madrid',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...VTIMEZONE,
    ...entries.filter((e) => e?.date).flatMap(vevent),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n');
}

/** Enlace "Añadir a Google Calendar" (sin cuentas ni permisos). */
export function googleCalendarUrl(e) {
  const t = times(e);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: title(e),
    dates: `${t.start}/${t.end}`,
    details: describe(e),
    location: e.location || '',
    ...(t.allDay ? {} : { ctz: 'Europe/Madrid' }),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** Enlace "Añadir a Outlook.com / Office 365". */
export function outlookCalendarUrl(e) {
  const t = times(e);
  const iso = (s, allDay) =>
    allDay ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:00`;
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title(e),
    startdt: iso(t.start, t.allDay),
    enddt: iso(t.end, t.allDay),
    allday: String(t.allDay),
    body: describe(e),
    location: e.location || '',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`;
}
