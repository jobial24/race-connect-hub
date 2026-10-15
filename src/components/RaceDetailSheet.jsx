import React, { useEffect } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Clock,
  Hash,
  Ticket,
  Trophy,
  Navigation,
  ExternalLink,
  Pencil,
  Trash2,
  Download,
  Target,
  Medal,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FALLBACK_IMAGE } from '@/services/raceStore';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/ics';
import { downloadIcs } from '@/services/myRaces';
import { daysBetween, todayLocal } from '@/lib/raceDedupe';
import { formatRange, durationLabel } from '@/lib/dates';

export const DISCIPLINE_COLORS = {
  'Trail running': { dot: 'bg-emerald-400', chip: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' },
  'OCR / Obstáculos': { dot: 'bg-violet-400', chip: 'bg-violet-500/20 text-violet-200 border-violet-500/40' },
  default: { dot: 'bg-orange-400', chip: 'bg-orange-500/20 text-orange-200 border-orange-500/40' },
};
export const colorsFor = (d) => DISCIPLINE_COLORS[d] || DISCIPLINE_COLORS.default;

function Row({ icon: Icon, label, value, accent }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      <Icon className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
      <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
      <span className={`text-sm ${accent ? 'text-orange-300 font-bold' : 'text-gray-100'} min-w-0 break-words`}>{value}</span>
    </div>
  );
}

/**
 * Ficha detallada de una carrera (mía o del catálogo) en hoja inferior / modal.
 * props: entry (inscripción o carrera), mine (bool), going (lista ¿quién va?), onEdit, onDelete, onSignup, onClose
 */
export default function RaceDetailSheet({ entry, mine, going, onEdit, onDelete, onSignup, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!entry) return null;
  const days = daysBetween(todayLocal(), entry.date);
  // inscripción a un día concreto de un evento de varios días → mostrar ambos
  const eventRange = entry.eventEndDate ? formatRange({ date: entry.eventDate, endDate: entry.eventEndDate }, { long: true }) : '';
  const when = formatRange(entry, { long: true }) + (durationLabel(entry) ? ` · ${durationLabel(entry)}` : '');
  const mapsUrl =
    entry.lat != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${entry.lat},${entry.lon}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.location || entry.name)}`;
  const web = entry.registrationUrl || entry.link || entry.officialUrl;
  const c = colorsFor(entry.discipline);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-[#111827] border border-white/10 rounded-t-2xl sm:rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="relative h-36 bg-gray-950">
          <img
            src={entry.image || FALLBACK_IMAGE}
            alt=""
            className="w-full h-full object-cover opacity-70"
            onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111827] to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${c.chip}`}>{entry.discipline || 'Carrera'}</span>
            {days >= 0 && (
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${days <= 7 ? 'bg-orange-500 text-white' : 'bg-white/15 text-white'}`}>
                {days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `Faltan ${days} días`}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 pt-3 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">{entry.name}</h2>
            {mine && <p className="text-xs text-emerald-400 font-semibold mt-1">✓ Estás inscrito{entry.distance ? ` · ${entry.distance}` : ''}</p>}
          </div>

          <div>
            <Row icon={Calendar} label={mine && eventRange ? 'Mi día' : 'Fecha'} value={when} />
            {mine && eventRange && <Row icon={Calendar} label="Evento" value={eventRange} />}
            <Row icon={Clock} label="Salida" value={entry.startTime && `${entry.startTime} h`} />
            <Row icon={MapPin} label="Lugar" value={entry.location} />
            <Row icon={Trophy} label="Distancia" value={entry.distance || entry.distanceText} />
            <Row icon={Hash} label="Dorsal" value={entry.bib} accent />
            <Row icon={Ticket} label="Código" value={entry.confirmationCode} />
            <Row icon={Trophy} label="Precio" value={entry.price != null && entry.price !== '' ? `${entry.price} €` : ''} />
            <Row icon={MapPin} label="Recogida dorsal" value={entry.pickup} />
            <Row icon={Target} label="Objetivo" value={entry.goalTime} />
            <Row icon={Medal} label="Mi tiempo" value={entry.finishTime} accent />
            <Row icon={Users} label="¿Quién va?" value={going?.length ? going.map((g) => g.display_name).join(', ') : ''} />
            {entry.notes && <p className="text-sm text-gray-300 py-2">{entry.notes}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="gap-1.5 text-xs" onClick={() => window.open(mapsUrl, '_blank', 'noopener')}>
              <Navigation className="w-3.5 h-3.5" /> Cómo llegar
            </Button>
            {web && (
              <Button variant="secondary" className="gap-1.5 text-xs" onClick={() => window.open(web, '_blank', 'noopener')}>
                <ExternalLink className="w-3.5 h-3.5" /> {mine ? 'Inscripción / web' : 'Web oficial'}
              </Button>
            )}
          </div>

          {mine && entry.date && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Añadir a mi calendario</p>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={googleCalendarUrl(entry)}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white flex items-center justify-center"
                >
                  Google
                </a>
                <button
                  onClick={() => downloadIcs(entry)}
                  className="h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Apple / .ics
                </button>
                <a
                  href={outlookCalendarUrl(entry)}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white flex items-center justify-center"
                >
                  Outlook
                </a>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {mine ? (
              <>
                <Button className="flex-1 gap-1.5" onClick={onEdit}>
                  <Pencil className="w-4 h-4" /> Editar datos
                </Button>
                <Button variant="ghost" className="text-red-400 hover:text-red-300 gap-1.5" onClick={onDelete}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button className="flex-1" onClick={onSignup}>
                Ya estoy inscrito
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
