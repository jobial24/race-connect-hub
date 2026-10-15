import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin, CalendarDays, Users, Clock, ArrowLeft, CheckCircle2,
  Loader2, Trophy, Wallet, ExternalLink, UserPlus, UserCheck,
  Mountain, Share2, Timer, Car, MessageSquare, Send, Navigation
} from 'lucide-react';
import { db } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatSecondsToHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatPace(secPerKm) {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} min/km`;
}

export default function RaceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [race, setRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [myReg, setMyReg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [going, setGoing] = useState([]);
  const [amGoing, setAmGoing] = useState(false);
  const [attSubmitting, setAttSubmitting] = useState(false);
  const [targetGoal, setTargetGoal] = useState('Sub 45m / Grupeta');

  const [paceSec, setPaceSec] = useState(285);
  const [carpools, setCarpools] = useState([]);
  const [newCarpool, setNewCarpool] = useState({ from_city: user?.city || 'Terrassa', seats: 3, time: '07:30', notes: '' });
  const [showCarpoolForm, setShowCarpoolForm] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await db.entities.Race.get(id);
        setRace(r);

        const regs = await db.entities.Registration.filter({ race_id: id, status: 'activa' }, { limit: 100 });
        const mine = (regs.items || []).find(
          (reg) => reg.created_by_id === user?.id || reg.user_email === user?.email
        );
        if (mine) {
          setRegistered(true);
          setMyReg(mine);
        } else {
          setRegistered(false);
          setMyReg(null);
        }

        const atts = await db.entities.Attendance.filter({ race_id: id }, { limit: 100 });
        const attItems = atts.items || [];
        setGoing(attItems);
        setAmGoing(attItems.some((a) => a.created_by_id === user?.id));

        const cars = await db.entities.Carpool.filter({ race_id: id }, { limit: 50 });
        setCarpools(cars.items || []);

        const comms = await db.entities.Comment.filter({ race_id: id }, { sort: '-created_date', limit: 50 });
        setComments(comms.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user?.id, user?.email]);

  const racePrediction = useMemo(() => {
    if (!race) return null;
    const dist = Number(race.distance_km) || 10;
    const elev = Number(race.elevation_gain) || 0;
    const effortKm = dist + elev / 100;
    const totalSeconds = effortKm * paceSec;

    let etaClock = '—';
    if (race.start_time && /^\d{2}:\d{2}$/.test(race.start_time)) {
      const [sh, sm] = race.start_time.split(':').map(Number);
      const finishDate = new Date();
      finishDate.setHours(sh, sm, 0, 0);
      finishDate.setSeconds(finishDate.getSeconds() + totalSeconds);
      etaClock = finishDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    return {
      effortKm: effortKm.toFixed(1),
      totalTime: formatSecondsToHMS(totalSeconds),
      halfTime: formatSecondsToHMS(totalSeconds * 0.5),
      etaClock,
    };
  }, [race, paceSec]);

  const handleRegister = async () => {
    if (!race) return;
    if (race.spots && (race.registered || 0) >= race.spots) {
      setError('No quedan plazas disponibles para esta carrera.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const nextBib = String(1000 + (Number(race.registered) || 0) + 1);
      const reg = await db.entities.Registration.create({
        race_id: race.id,
        race_name: race.name,
        race_date: race.date,
        race_distance: race.distance,
        race_city: race.city,
        race_location: race.location,
        bib_number: nextBib,
        status: 'activa',
        user_email: user?.email,
        user_name: user?.full_name || user?.email,
        created_by_id: user?.id,
      });
      const newCount = (race.registered || 0) + 1;
      await db.entities.Race.update(race.id, { registered: newCount });
      setRegistered(true);
      setMyReg(reg);
      setRace({ ...race, registered: newCount });
    } catch (e) {
      setError('No se pudo completar la inscripción.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!myReg) return;
    setSubmitting(true);
    try {
      await db.entities.Registration.update(myReg.id, { status: 'cancelada' });
      const newCount = Math.max(0, (race.registered || 0) - 1);
      await db.entities.Race.update(race.id, { registered: newCount });
      setRegistered(false);
      setMyReg(null);
      setRace({ ...race, registered: newCount });
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGoing = async () => {
    if (!user || !race) return;
    setAttSubmitting(true);
    try {
      if (amGoing) {
        const mine = going.find((a) => a.created_by_id === user.id);
        if (mine) {
          await db.entities.Attendance.delete(mine.id);
          setGoing(going.filter((a) => a.id !== mine.id));
        }
        setAmGoing(false);
      } else {
        const att = await db.entities.Attendance.create({
          race_id: race.id,
          race_name: race.name,
          user_name: user.full_name || user.email,
          goal: targetGoal,
          created_by_id: user.id,
        });
        setGoing([...going, att]);
        setAmGoing(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAttSubmitting(false);
    }
  };

  const handleAddCarpool = async (e) => {
    e.preventDefault();
    if (!user || !race) return;
    const item = await db.entities.Carpool.create({
      race_id: race.id,
      driver_name: user.full_name || user.email,
      from_city: newCarpool.from_city,
      seats: Number(newCarpool.seats),
      time: newCarpool.time,
      notes: newCarpool.notes,
      created_by_id: user.id,
    });
    setCarpools([...carpools, item]);
    setShowCarpoolForm(false);
    setNewCarpool({ ...newCarpool, notes: '' });
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !user || !race) return;
    const item = await db.entities.Comment.create({
      race_id: race.id,
      user_name: user.full_name || user.email,
      text: commentText.trim(),
      created_by_id: user.id,
    });
    setComments([item, ...comments]);
    setCommentText('');
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!race) return <div className="text-center py-24"><p className="text-muted-foreground">Carrera no encontrada.</p><Link to="/" className="text-primary text-sm font-medium">Volver</Link></div>;

  const pct = race.spots ? Math.min(100, Math.round(((race.registered || 0) / race.spots) * 100)) : 0;
  const full = race.spots && (race.registered || 0) >= race.spots;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${race.location || ''} ${race.city || ''}`)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Volver al calendario
        </Link>
        <div className="flex items-center gap-2">
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-medium hover:border-primary/40">
            <Navigation className="w-3.5 h-3.5 text-primary" /> Mapa
          </a>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-border">
        <div className="aspect-[16/7] sm:aspect-[16/5] w-full bg-muted">
          {race.image ? <img src={race.image} alt={race.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-primary/20" />}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/35 to-transparent" />
        <div className="absolute inset-0 p-5 sm:p-8 flex flex-col justify-end text-background">
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold">{race.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-background/85">
            <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-primary" /> {formatDate(race.date)}</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" /> {race.city}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-4">
            <h2 className="font-heading text-lg font-bold">Sobre la carrera</h2>
            <p className="text-muted-foreground leading-relaxed">{race.description || 'Sin descripción.'}</p>
          </div>

          {racePrediction && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-heading text-base font-bold flex items-center gap-2"><Timer className="w-5 h-5 text-primary" /> Calculadora de ritmo</h3>
              <input type="range" min={180} max={540} step={5} value={paceSec} onChange={(e) => setPaceSec(Number(e.target.value))} className="w-full accent-primary cursor-pointer" />
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-muted/50 text-xs"><span className="text-muted-foreground block">Mitad</span><span className="font-bold">{racePrediction.halfTime}</span></div>
                <div className="p-3 rounded-xl bg-primary/10 text-primary text-xs"><span className="font-semibold block">Meta</span><span className="font-extrabold">{racePrediction.totalTime}</span></div>
                <div className="p-3 rounded-xl bg-muted/50 text-xs"><span className="text-muted-foreground block">Hora Aprox.</span><span className="font-bold">{racePrediction.etaClock}</span></div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-heading text-base font-bold flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> ¿Quién va? ({going.length})</h3>
            {going.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {going.map((a) => (
                  <div key={a.id} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-medium">
                    <span className="grid place-items-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{initials(a.user_name)}</span>
                    <span>{a.user_name}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={toggleGoing} className={cn('w-full py-2.5 rounded-xl text-sm font-semibold border transition flex items-center justify-center gap-2', amGoing ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>
              {amGoing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {amGoing ? 'Asistencia confirmada' : 'Confirmar asistencia'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-20 rounded-2xl border border-border bg-card p-5 space-y-4">
            <p className="text-xs text-muted-foreground uppercase">Inscripción</p>
            <p className="font-display text-3xl font-extrabold">{race.price > 0 ? `${race.price}€` : 'Gratis'}</p>
            {registered ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 text-emerald-600 px-3 py-2.5 text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> ¡Inscrito! (#{myReg?.bib_number})
                </div>
                <button onClick={handleCancel} className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-destructive">Cancelar</button>
              </div>
            ) : full ? (
              <div className="rounded-xl bg-muted text-muted-foreground px-3 py-2.5 text-center text-sm">Agotado</div>
            ) : (
              <button onClick={handleRegister} disabled={submitting} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} Inscribirme
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
