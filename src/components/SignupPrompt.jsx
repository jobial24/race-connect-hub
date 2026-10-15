import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getPendingSignup, clearPendingSignup, buildSignup, saveSignup } from '@/services/myRaces';
import { getRaces } from '@/services/raceStore';

/**
 * Al volver a la app tras pulsar "Inscribirme", pregunta si se completó la
 * inscripción y la guarda en un toque (carrera, fecha, distancia y precio ya conocidos).
 */
export default function SignupPrompt() {
  const [pending, setPending] = useState(null);
  const [saved, setSaved] = useState(null);
  const navigate = useNavigate();

  const check = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    const p = getPendingSignup();
    // solo preguntar cuando el usuario vuelve (al menos 20 s fuera)
    if (p && Date.now() - p.at > 20000) {
      const race = (getRaces() || []).find((r) => r.id === p.raceId);
      setPending(race ? { ...p, race } : null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    check();
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [check]);

  if (saved) {
    return (
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 inset-x-3 sm:left-auto sm:right-6 sm:w-96 z-40 bg-emerald-950/95 border border-emerald-500/40 rounded-2xl p-4 shadow-2xl">
        <div className="flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-sm text-emerald-100 flex-1">
            <p className="font-semibold">Guardada en Mis carreras</p>
            <p className="text-xs text-emerald-200/80 mt-0.5">Cuando te llegue el email de confirmación, impórtalo para añadir dorsal y código.</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => { setSaved(null); navigate('/my-races'); }}>
                Ver mis carreras
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSaved(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!pending) return null;
  const { race, distance } = pending;

  const yes = () => {
    const insc = race.inscriptions?.find((i) => i.label === distance);
    const entry = saveSignup(buildSignup(race, { distance, registrationUrl: insc?.url || pending.url }));
    clearPendingSignup();
    setPending(null);
    setSaved(entry);
  };
  const no = () => {
    clearPendingSignup();
    setPending(null);
  };

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 inset-x-3 sm:left-auto sm:right-6 sm:w-96 z-40 bg-[#111827] border border-orange-500/40 rounded-2xl p-4 shadow-2xl shadow-black/50">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-orange-400 font-semibold">¿Te has inscrito?</p>
          <p className="text-sm font-semibold text-white mt-1 leading-snug">
            {race.name}
            {distance && <span className="text-orange-300"> · {distance}</span>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{race.date} · {race.location}</p>
        </div>
        <button onClick={() => setPending(null)} className="text-gray-500 hover:text-white cursor-pointer" aria-label="Preguntar más tarde">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button size="sm" className="flex-1" onClick={yes}>
          Sí, guardar
        </Button>
        <Button size="sm" variant="secondary" className="flex-1" onClick={no}>
          No me he inscrito
        </Button>
      </div>
    </div>
  );
}
