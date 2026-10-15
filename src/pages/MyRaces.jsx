import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  List,
  MapPin,
  Hash,
  Wand2,
  Upload,
  Loader2,
  CalendarPlus,
  Plus,
  AlertTriangle,
  Medal,
  Cloud,
  CloudOff,
  RefreshCw,
  Copy,
  Check,
  Download,
  Link2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import SignupDialog from '@/components/SignupDialog';
import RaceDetailSheet, { colorsFor } from '@/components/RaceDetailSheet';
import MonthCalendar from '@/components/MonthCalendar';
import {
  getMyRaces,
  deleteSignup,
  parseReceiptAI,
  downloadAllIcs,
  syncWithCloud,
  getCalendarFeedUrl,
  getAttendees,
} from '@/services/myRaces';
import { getRaces, FALLBACK_IMAGE } from '@/services/raceStore';
import { todayLocal, daysBetween, dedupeRaces, isPast, nameSimilarity } from '@/lib/raceDedupe';
import { calculateDistanceKm } from '@/lib/places';
import { cloudEnabled } from '@/lib/supabase';
import { formatRange, durationLabel } from '@/lib/dates';
import { useCloudUser } from '@/lib/useCloudUser';

const VIEW_KEY = 'race_connect_myraces_view';

function formatDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!iso) return 'Fecha por confirmar';
  const t = new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', opts);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// coincidencia aproximada entre el comprobante y el catálogo (por si la IA no la encuentra)
function bestMatch(races, name, date) {
  let best = null;
  for (const r of races) {
    const score = nameSimilarity(name, r.name) + (date && Math.abs(daysBetween(r.date, date)) <= 1 ? 0.5 : 0);
    if (score > 0.6 && (!best || score > best.score)) best = { race: r, score };
  }
  return best?.race || null;
}

function loadOrigin() {
  try {
    return JSON.parse(localStorage.getItem('race_connect_origin') || 'null');
  } catch {
    return null;
  }
}

/** Fila compacta de una inscripción (lista y "día seleccionado"). */
function EntryRow({ e, onOpen }) {
  const d = daysBetween(todayLocal(), e.date);
  const c = colorsFor(e.discipline);
  return (
    <button
      onClick={onOpen}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
        e.mine ? 'bg-[#111827] border-white/10 hover:border-orange-500/40' : 'bg-transparent border-dashed border-white/10 hover:border-white/30'
      }`}
    >
      <div className="w-12 shrink-0 text-center">
        <p className="text-[10px] uppercase text-gray-500">{formatDate(e.date, { month: 'short' })}</p>
        <p className="text-xl font-black text-white leading-none">
          {e.date ? Number(e.date.slice(8)) : '–'}
          {e.endDate && e.endDate > e.date && <span className="text-sm">–{Number(e.endDate.slice(8))}</span>}
        </p>
      </div>
      <span className={`w-1 self-stretch rounded-full ${e.mine ? c.dot : 'bg-white/10'}`} />
      <div className="min-w-0 flex-1">
        <p className={`font-semibold truncate ${e.mine ? 'text-white' : 'text-gray-300'}`}>{e.name}</p>
        <p className="text-xs text-gray-400 flex flex-wrap gap-x-3">
          {e.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {e.location}
            </span>
          )}
          {e.distance && <span className="text-orange-300 font-semibold">{e.distance}</span>}
          {durationLabel(e) && <span className="text-sky-300">{durationLabel(e)}</span>}
          {e.bib && (
            <span className="inline-flex items-center gap-0.5">
              <Hash className="w-3 h-3" /> {e.bib}
            </span>
          )}
          {e.finishTime && (
            <span className="inline-flex items-center gap-1 text-yellow-300">
              <Medal className="w-3 h-3" /> {e.finishTime}
            </span>
          )}
          {!e.mine && e.distanceKm != null && <span>a {e.distanceKm} km</span>}
        </p>
      </div>
      {e.mine && d >= 0 && (
        <span
          className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold ${d <= 7 ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-200'}`}
        >
          {d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `${d} d`}
        </span>
      )}
    </button>
  );
}

/** Panel para sincronizar con Google / Apple / Outlook. */
function CalendarSyncPanel({ items, user, onClose }) {
  const [feedUrl, setFeedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getCalendarFeedUrl()
      .then(setFeedUrl)
      .catch(() => setFeedUrl(null))
      .finally(() => setLoading(false));
  }, [user]);

  const webcal = feedUrl?.replace(/^https?:/, 'webcal:');
  const local = /localhost|127\.0\.0\.1|192\.168\./.test(feedUrl || location.host);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="bg-[#111827] border border-orange-500/40 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Sincronizar con tu calendario</h2>
          <p className="text-xs text-gray-400 mt-1">Tus carreras en Google Calendar, el calendario del iPhone u Outlook, con aviso una semana y un día antes.</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white cursor-pointer" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <Link2 className="w-4 h-4 text-orange-400" /> 1 · Suscripción automática <span className="text-[10px] font-normal text-emerald-400">(recomendado)</span>
        </p>
        {!cloudEnabled ? (
          <p className="text-xs text-gray-400">Necesita la base de datos (Supabase). Cuando esté conectada, tus carreras nuevas aparecerán solas en tu calendario.</p>
        ) : !user ? (
          <p className="text-xs text-gray-400">Entra con tu cuenta para obtener tu enlace de calendario personal.</p>
        ) : loading ? (
          <p className="text-xs text-gray-400 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparando tu enlace…
          </p>
        ) : feedUrl ? (
          <>
            <div className="flex gap-2">
              <input readOnly value={feedUrl} className="flex-1 min-w-0 h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-[11px] text-gray-300" />
              <Button size="sm" variant="secondary" className="gap-1" onClick={copy}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}
                target="_blank"
                rel="noreferrer"
                className="h-10 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center justify-center"
              >
                Suscribirme en Google Calendar
              </a>
              <a href={webcal} className="h-10 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center justify-center">
                iPhone / Mac / Outlook
              </a>
            </div>
            {local && (
              <p className="text-[11px] text-yellow-400/90 flex gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Ahora la app está en tu ordenador: Google no puede leer este enlace hasta que publiques el servidor (npm start en Render/Railway). El calendario
                del propio Mac/PC sí funciona.
              </p>
            )}
            <p className="text-[11px] text-gray-500">Es un enlace privado: no lo compartas.</p>
          </>
        ) : (
          <p className="text-xs text-red-300">No se pudo obtener el enlace. ¿Has ejecutado supabase/schema.sql?</p>
        )}
      </div>

      <div className="rounded-xl border border-white/10 p-4 space-y-2">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <Download className="w-4 h-4 text-orange-400" /> 2 · Descargar e importar
        </p>
        <p className="text-xs text-gray-400">Un archivo .ics con todas tus carreras ({items.length}). Ábrelo en el móvil o impórtalo en Google Calendar (Ajustes → Importar).</p>
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => downloadAllIcs(items)} disabled={!items.length}>
          <CalendarPlus className="w-3.5 h-3.5" /> Descargar mis carreras (.ics)
        </Button>
      </div>

      <p className="text-[11px] text-gray-500">También puedes añadir una carrera suelta desde su ficha (Google, Apple u Outlook).</p>
    </section>
  );
}

export default function MyRaces() {
  const navigate = useNavigate();
  const user = useCloudUser();
  const [items, setItems] = useState([]);
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) || 'calendar';
    } catch {
      return 'calendar';
    }
  });
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(todayLocal());
  const [showOthers, setShowOthers] = useState(true);
  const [detail, setDetail] = useState(null); // {entry, mine}
  const [dialog, setDialog] = useState(null); // {race, initial}
  const [panel, setPanel] = useState(null); // 'import' | 'calendar'
  const [receiptText, setReceiptText] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [cloud, setCloud] = useState({ state: 'idle' });
  const [going, setGoing] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  useEffect(() => {
    const load = () => setItems(getMyRaces());
    load();
    window.addEventListener('myraces:updated', load);
    return () => window.removeEventListener('myraces:updated', load);
  }, []);

  // Sincronizar con la nube al entrar (si hay cuenta)
  const runCloudSync = () => {
    if (!cloudEnabled || !user) return;
    setCloud({ state: 'syncing' });
    syncWithCloud()
      .then(() => setCloud({ state: 'ok', at: Date.now() }))
      .catch((e) => setCloud({ state: 'error', error: e.message }));
  };
  useEffect(runCloudSync, [user]);

  useEffect(() => {
    if (!user || !items.length) return;
    getAttendees(items.map((m) => m.raceId).filter(Boolean)).then(setGoing).catch(() => {});
  }, [user, items]);

  const today = todayLocal();
  const { upcoming, past } = useMemo(() => {
    const sorted = [...items].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return {
      upcoming: sorted.filter((m) => !m.date || m.date >= today),
      past: sorted.filter((m) => m.date && m.date < today).reverse(),
    };
  }, [items, today]);

  // Otras carreras del calendario cerca de ti (para ver huecos y planificar)
  const others = useMemo(() => {
    if (!showOthers) return [];
    const origin = loadOrigin();
    const mineIds = new Set(items.map((m) => m.raceId));
    return dedupeRaces(getRaces() || [])
      .filter((r) => !isPast(r, today) && !mineIds.has(r.id))
      .map((r) => ({ ...r, distanceKm: origin ? calculateDistanceKm(origin.lat, origin.lon, r.lat, r.lon) : null }))
      .filter((r) => r.distanceKm == null || r.distanceKm <= 60);
  }, [showOthers, items, today]);

  const calItems = useMemo(
    () => [
      ...items.map((m) => ({ ...m, key: `m-${m.id}`, mine: true })),
      ...others.map((r) => ({ ...r, key: `r-${r.id}`, mine: false })),
    ],
    [items, others]
  );

  const dayItems = calItems
    .filter((it) => it.date && it.date <= selectedDay && (it.endDate || it.date) >= selectedDay)
    .sort((a, b) => Number(b.mine) - Number(a.mine));

  const next = upcoming[0];
  const catalog = () => getRaces() || [];

  const openItem = (it) => setDetail({ entry: it, mine: it.mine !== false && !it.key?.startsWith('r-') });

  const handleImport = async () => {
    setImporting(true);
    setError('');
    try {
      const races = catalog().filter((r) => !isPast(r, today));
      const receipt = await parseReceiptAI({
        text: receiptText,
        file: receiptFile,
        candidates: races.map((r) => ({ id: r.id, name: r.name, date: r.date, location: r.location })),
      });
      const race = races.find((r) => r.id === receipt.matchedRaceId) || bestMatch(races, receipt.raceName, receipt.date) || null;
      const existing = race && items.find((m) => m.raceId === race.id);
      setDialog({
        race,
        initial: {
          ...(existing || {}),
          ...(race ? {} : { name: receipt.raceName, date: receipt.date, location: receipt.location }),
          distance: receipt.distance,
          bib: receipt.bib,
          price: receipt.price,
          confirmationCode: receipt.confirmationCode,
          startTime: receipt.startTime,
          pickup: receipt.pickup,
          platform: receipt.platform,
          source: 'comprobante',
        },
      });
      setPanel(null);
      setReceiptText('');
      setReceiptFile(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const onPaste = (e) => {
    const file = [...(e.clipboardData?.files || [])][0];
    if (file && /^image\//.test(file.type)) {
      e.preventDefault();
      setReceiptFile(file);
    }
  };

  return (
    <div className="flex-1 px-4 py-5 sm:p-6 md:p-10 bg-[#0B0F19] text-gray-100 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-white">Mis inscripciones</h1>
            <p className="text-sm text-gray-400 mt-1">
              {upcoming.length ? `${upcoming.length} carreras por delante` : 'Todavía no tienes carreras apuntadas'}
              {past.length ? ` · ${past.length} completadas` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setPanel(panel === 'import' ? null : 'import')} className="gap-1.5">
              <Wand2 className="w-4 h-4" /> Importar comprobante
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPanel(panel === 'calendar' ? null : 'calendar')} className="gap-1.5">
              <CalendarPlus className="w-4 h-4" /> Sincronizar calendario
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog({ race: null, initial: { source: 'manual' } })} className="gap-1.5">
              <Plus className="w-4 h-4" /> Manual
            </Button>
          </div>
        </div>

        {/* Estado de la nube */}
        {cloudEnabled && (
          <div className="flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-xl border border-white/10 bg-white/5">
            {user ? (
              <>
                <span className="flex items-center gap-2 text-gray-300">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  {cloud.state === 'syncing'
                    ? 'Sincronizando…'
                    : cloud.state === 'error'
                    ? `Error al sincronizar: ${cloud.error}`
                    : 'Guardado en tu cuenta · igual en el móvil y el ordenador'}
                </span>
                <button onClick={runCloudSync} className="text-gray-400 hover:text-white cursor-pointer" aria-label="Sincronizar ahora">
                  <RefreshCw className={`w-4 h-4 ${cloud.state === 'syncing' ? 'animate-spin' : ''}`} />
                </button>
              </>
            ) : (
              <>
                <span className="flex items-center gap-2 text-gray-400">
                  <CloudOff className="w-4 h-4" /> Solo en este dispositivo
                </span>
                <button onClick={() => navigate('/login')} className="text-orange-400 font-semibold hover:underline cursor-pointer">
                  Entrar para sincronizar
                </button>
              </>
            )}
          </div>
        )}

        {panel === 'calendar' && <CalendarSyncPanel items={items} user={user} onClose={() => setPanel(null)} />}

        {panel === 'import' && (
          <section className="bg-[#111827] border border-orange-500/40 rounded-2xl p-5 space-y-3">
            <div>
              <h2 className="font-semibold text-white">Importar desde el email de confirmación</h2>
              <p className="text-xs text-gray-400 mt-1">
                Pega el texto del email (xipgroc, rockthesport, sportmaniacs…), pega una captura con Ctrl+V o adjunta el PDF del justificante. La
                IA saca distancia, dorsal, código, precio y hora, y lo enlaza con la carrera del calendario. No se guardan DNI ni datos personales.
              </p>
            </div>
            <textarea
              value={receiptText}
              onChange={(e) => setReceiptText(e.target.value)}
              onPaste={onPaste}
              rows={5}
              placeholder="Pega aquí el email de confirmación… (o una captura con Ctrl+V)"
              className="w-full rounded-xl border border-white/10 bg-[#0B0F19]/60 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-orange-500 focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" /> Captura o PDF
                </Button>
                {receiptFile && (
                  <span className="truncate max-w-[200px]">
                    {receiptFile.name || 'captura pegada'}{' '}
                    <button className="text-red-400 cursor-pointer" onClick={() => setReceiptFile(null)}>
                      ✕
                    </button>
                  </span>
                )}
              </div>
              <Button onClick={handleImport} disabled={importing || (!receiptText.trim() && !receiptFile)} className="gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {importing ? 'Leyendo…' : 'Leer comprobante'}
              </Button>
            </div>
            {error && (
              <p className="text-xs text-red-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {error}
              </p>
            )}
          </section>
        )}

        {/* Próxima carrera */}
        {next && (
          <button
            onClick={() => openItem({ ...next, mine: true })}
            className="w-full relative overflow-hidden rounded-2xl border border-orange-500/30 text-left cursor-pointer"
          >
            <img src={next.image || FALLBACK_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <div className="relative p-4 sm:p-5 bg-gradient-to-r from-[#111827] via-[#111827]/90 to-transparent">
              <p className="text-[11px] uppercase tracking-wider text-orange-400 font-semibold">Tu próxima carrera</p>
              <p className="text-lg sm:text-xl font-bold text-white mt-1">{next.name}</p>
              <p className="text-xs text-gray-300 mt-1">
                {formatRange(next, { long: true })}
                {next.startTime ? ` · ${next.startTime} h` : ''} · {next.location}
              </p>
              <p className="text-3xl font-black text-orange-400 mt-2">
                {(() => {
                  const d = daysBetween(today, next.date);
                  return d === 0 ? '¡Hoy!' : d === 1 ? 'Mañana' : `${d} días`;
                })()}
              </p>
            </div>
          </button>
        )}

        {/* Vista */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-white/10 p-0.5 bg-[#111827]" role="group" aria-label="Vista">
            {[
              ['calendar', 'Calendario', CalendarIcon],
              ['list', 'Lista', List],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                aria-pressed={view === id}
                className={`h-8 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  view === id ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          {view === 'calendar' && (
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={showOthers} onChange={(e) => setShowOthers(e.target.checked)} className="w-4 h-4 accent-orange-500" />
              Ver también otras carreras cercanas
            </label>
          )}
        </div>

        {view === 'calendar' ? (
          <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
            <MonthCalendar
              month={month}
              onMonthChange={setMonth}
              items={calItems}
              selected={selectedDay}
              onSelectDay={setSelectedDay}
              onSelectItem={openItem}
            />
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                {formatDate(selectedDay, { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              {dayItems.length ? (
                dayItems.map((it) => <EntryRow key={it.key} e={it} onOpen={() => openItem(it)} />)
              ) : (
                <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-white/10 rounded-xl">Sin carreras este día</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {items.length === 0 && (
              <div className="text-center py-14 border border-dashed border-white/10 rounded-2xl space-y-3">
                <p className="text-sm text-gray-400 px-4">
                  Pulsa <strong className="text-gray-200">Inscribirme</strong> en cualquier carrera del calendario: al volver, la app te preguntará si te has
                  inscrito y lo guardará aquí en un toque.
                </p>
                <Button variant="secondary" onClick={() => navigate('/')}>
                  Ir al calendario
                </Button>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Próximas</h2>
                {upcoming.map((m) => (
                  <EntryRow key={m.id} e={{ ...m, mine: true }} onOpen={() => openItem({ ...m, mine: true })} />
                ))}
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Completadas</h2>
                {past.map((m) => (
                  <EntryRow key={m.id} e={{ ...m, mine: true }} onOpen={() => openItem({ ...m, mine: true })} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {detail && (
        <RaceDetailSheet
          entry={detail.entry}
          mine={detail.mine}
          going={going[detail.entry.raceId || detail.entry.id]}
          onClose={() => setDetail(null)}
          onEdit={() => {
            const m = detail.entry;
            setDetail(null);
            setDialog({ race: catalog().find((r) => r.id === m.raceId) || null, initial: m });
          }}
          onDelete={() => {
            if (window.confirm(`¿Quitar "${detail.entry.name}" de tus inscripciones?`)) {
              deleteSignup(detail.entry.id);
              setDetail(null);
            }
          }}
          onSignup={() => {
            const r = detail.entry;
            setDetail(null);
            setDialog({ race: r, initial: {} });
          }}
        />
      )}

      {dialog && (
        <SignupDialog
          race={dialog.race}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
