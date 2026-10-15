import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, CalendarDays, Flame, Loader2, ArrowRight, Trophy, Timer, Award } from 'lucide-react';
import { db } from '@/api/client';

export default function Home() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await db.entities.Race.filter({}, { sort: 'date', limit: 50 });
        setRaces(res.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white py-16 px-6 sm:px-12 shadow-md mb-10">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 bg-emerald-500/30 text-emerald-100 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase backdrop-blur-sm">
            <Flame className="w-4 h-4 text-amber-300" /> Calendario Oficial 2026
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Race Connect Hub
          </h1>
          <p className="text-emerald-100 text-base sm:text-lg max-w-2xl font-light">
            Encuentra y compara tu próxima competición de asfalto, trail running, medias maratones y obstáculos (OCR) en Cataluña y España.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 sm:px-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-emerald-600" /> Próximas Competiciones
          </h2>
          <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-3 py-1 rounded-full">
            {races.length} carreras disponibles
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : races.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-500 text-sm">No hay carreras registradas en este momento.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {races.map((race) => (
              <Link
                key={race.id}
                to={`/carrera/${race.id}`}
                className="group bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-xl hover:border-emerald-500 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                      {race.distance}
                    </span>
                    <span className="text-base font-extrabold text-slate-900">
                      {race.price > 0 ? `${race.price}€` : 'Gratis'}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-1 mb-3">
                    {race.name}
                  </h3>

                  <div className="space-y-2 text-xs text-slate-500">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-emerald-600" /> {race.date}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600" /> {race.city}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform">
                  <span>Ver detalles e inscripción</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}