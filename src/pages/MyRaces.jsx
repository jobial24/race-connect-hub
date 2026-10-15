import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Loader2, ClipboardList, Ticket, Trophy, CalendarPlus, Trash2, Timer, X, QrCode, CheckCircle2, Flame } from 'lucide-react';
import { db } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatMonth(iso) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('es-ES', { day: '2-digit' }),
    month: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
  };
}

function getDaysDiff(iso) {
  const target = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export default function MyRaces() {
  const { user } = useAuth();
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [selectedBib, setSelectedBib] = useState(null);
  const [editingResult, setEditingResult] = useState(null);
  const [finishTime, setFinishTime] = useState('');

  const loadRegs = async () => {
    setLoading(true);
    try {
      const res = await db.entities.Registration.filter({ status: 'activa' }, { sort: 'race_date' });
      setRegs(res.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRegs(); }, []);

  const { upcoming, past } = useMemo(() => {
    const up = [];
    const pa = [];
    regs.forEach((r) => {
      if (getDaysDiff(r.race_date) >= 0) up.push(r);
      else pa.push(r);
    });
    return { upcoming: up, past: pa.reverse() };
  }, [regs]);

  const activeList = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Mis carreras</h1>
          <p className="text-muted-foreground text-sm">Tus dorsales y marcas personales.</p>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-muted border border-border">
          <button onClick={() => setTab('upcoming')} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold', tab === 'upcoming' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>Próximas</button>
          <button onClick={() => setTab('past')} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold', tab === 'past' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>Completadas</button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> :
       activeList.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border"><ClipboardList className="w-9 h-9 mx-auto text-muted-foreground/50" /><p className="mt-3 text-muted-foreground">No hay registros en esta sección.</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {activeList.map((reg) => {
            const m = formatMonth(reg.race_date);
            const daysLeft = getDaysDiff(reg.race_date);
            return (
              <div key={reg.id} className="flex flex-col justify-between p-4 rounded-2xl border border-border bg-card">
                <Link to={`/carrera/${reg.race_id}`} className="flex gap-4">
                  <div className="shrink-0 w-14 h-16 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center font-bold">
                    <span className="text-xl leading-none">{m.day}</span>
                    <span className="text-[11px] uppercase mt-0.5">{m.month}</span>
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-[15px] line-clamp-1">{reg.race_name}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-3 h-3 text-primary" /> {reg.race_city}</p>
                  </div>
                </Link>
                <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                  <button onClick={() => setSelectedBib(reg)} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-primary/10 text-primary">
                    <Ticket className="w-3.5 h-3.5" /> Dorsal #{reg.bib_number || '1042'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBib && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/50 backdrop-blur-sm" onClick={() => setSelectedBib(null)}>
          <div className="relative w-full max-w-sm bg-card rounded-3xl border-2 border-primary p-6 text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl font-black">#{selectedBib.bib_number}</h3>
            <p className="text-sm font-bold text-primary">{selectedBib.race_name}</p>
            <div className="p-4 bg-white rounded-2xl inline-block"><QrCode className="w-24 h-24 text-black" /></div>
            <button onClick={() => setSelectedBib(null)} className="w-full py-2 bg-muted rounded-xl text-sm font-semibold">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
