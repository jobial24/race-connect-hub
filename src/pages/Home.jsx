import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  MapPin,
  Trophy,
  ExternalLink,
  Search,
  Tag,
  Sparkles,
  Navigation,
  ArrowUpDown,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Ticket,
  Users,
  List,
  Map as MapIcon,
} from 'lucide-react';
import { autoSyncIfStale, importRunneaRaces, resolveMissingCoords } from '@/services/runneaSync';
import { getRaces, saveRaces, getLastSync, FALLBACK_IMAGE } from '@/services/raceStore';
import { PRESET_LOCATIONS, SELECTABLE_CITIES, calculateDistanceKm } from '@/lib/places';
import SignupDialog from '@/components/SignupDialog';
import { getMyRaces, setPendingSignup, getAttendees } from '@/services/myRaces';
import { dedupeRaces, isPast, todayLocal } from '@/lib/raceDedupe';
import { useCloudUser } from '@/lib/useCloudUser';
import { zoneOf } from '@/lib/regions';
import { formatRange, durationLabel } from '@/lib/dates';
import { categoryOf, parseDistancesKm } from '@/lib/raceCategories';
import {
  EMPTY_FILTERS,
  DIST_PRESETS,
  DIST_SHORTCUTS,
  whenPreset,
  buildPlaceIndex,
  matchesFilters,
  placeCenter,
  placeLabel,
  RADIUS_STEPS,
} from '@/lib/smartSearch';
import SmartSearchBar from '@/components/SmartSearchBar';
import RaceMap from '@/components/RaceMap';

// Ejemplos de versiones anteriores: se eliminan en cuanto hay datos reales
const LEGACY_SEEDS = new Set(['spartan-bcn-2026', 'mitja-terrassa-2027']);
const VIEW_KEY = 'race_connect_view2';
const DEFAULT_FILTERS = { ...EMPTY_FILTERS, place: { kind: 'near', origin: true, radius: 50 } };

function loadView() {
  const base = { sortBy: 'date', mode: 'list', filters: DEFAULT_FILTERS };
  try {
    const v = { ...base, ...JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') };
    const f = { ...EMPTY_FILTERS, ...v.filters };
    // los atajos de fecha se recalculan (el "finde" guardado la semana pasada ya no vale)
    if (f.when) {
      const fresh = whenPreset(f.when.id);
      if (fresh) f.when = fresh;
      else if (f.when.to < todayLocal()) f.when = null;
    }
    return { ...v, filters: f };
  } catch {
    return base;
  }
}

const ORIGIN_KEY = 'race_connect_origin';

function loadOrigin() {
  try {
    const o = JSON.parse(localStorage.getItem(ORIGIN_KEY) || 'null');
    if (o && Number.isFinite(o.lat) && Number.isFinite(o.lon)) return o;
  } catch {
    /* ignore */
  }
  return { mode: 'city', name: 'Terrassa', ...PRESET_LOCATIONS.Terrassa };
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function distanceTone(km) {
  if (km == null) return 'bg-black/60 text-gray-400 border-white/10';
  if (km <= 25) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (km <= 75) return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
  return 'bg-black/60 text-gray-300 border-white/10';
}

const openExternal = (url) => window.open(url, '_blank', 'noopener');

/** Botones de inscripción de cada tarjeta. */
function Going({ list }) {
  if (!list?.length) return null;
  const names = list.map((a) => a.display_name);
  return (
    <p className="text-[11px] text-sky-300 flex items-center gap-1.5" title={names.join(', ')}>
      <Users className="w-3.5 h-3.5" />
      {list.length === 1 ? `Va ${names[0]}` : `Van ${names.slice(0, 2).join(', ')}${list.length > 2 ? ` y ${list.length - 2} más` : ''}`}
    </p>
  );
}

function RaceActions({ race, signup, going, onManual, onOpenMyRaces }) {
  if (signup) {
    return (
      <>
      <Going list={going} />
      <button
        onClick={onOpenMyRaces}
        className="w-full h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-500/15"
      >
        <CheckCircle2 className="w-4 h-4" />
        Inscrito{signup.distance ? ` · ${signup.distance}` : ''}
        {signup.bib ? ` · dorsal ${signup.bib}` : ''}
      </button>
      </>
    );
  }

  const open = (race.inscriptions || []).filter((i) => i.open && i.url);
  const go = (insc) => {
    setPendingSignup(race, insc); // al volver, la app preguntará "¿Te has inscrito?"
    openExternal(insc?.url || race.link);
  };

  return (
    <>
      <Going list={going} />
      {open.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
            <Ticket className="w-3 h-3 text-orange-400" /> Inscripción directa
          </p>
          <div className="flex flex-wrap gap-1.5">
            {open.slice(0, 5).map((i) => (
              <Button key={i.url + i.label} size="sm" className="text-xs gap-1 flex-1 min-w-[64px]" onClick={() => go(i)}>
                {i.label}
              </Button>
            ))}
          </div>
        </div>
      ) : race.link && race.link !== '#' ? (
        <Button className="w-full gap-2 text-xs" onClick={() => go(null)}>
          <span>{race.registrationUrl && race.link === race.registrationUrl ? 'Inscribirme' : 'Web oficial e inscripción'}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="w-full gap-2 text-xs"
          onClick={() => openExternal(`https://www.google.com/search?q=${encodeURIComponent(`${race.name} web oficial inscripción`)}`)}
        >
          <span>Buscar web oficial</span>
          <Search className="w-3.5 h-3.5" />
        </Button>
      )}
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="truncate">
          {race.inscriptions?.length && !open.length ? (
            <span className="text-yellow-500/80">Inscripciones cerradas</span>
          ) : (
            <>
              {race.officialUrl && open.length ? (
                <a href={race.officialUrl} target="_blank" rel="noreferrer" className="hover:text-gray-300">
                  {hostOf(race.officialUrl)}
                </a>
              ) : (
                hostOf(race.link)
              )}
              {race.webVerified && <span className="text-emerald-400"> · verificada</span>}
            </>
          )}
        </span>
        <button onClick={onManual} className="shrink-0 text-gray-400 hover:text-orange-300 cursor-pointer">
          Ya estoy inscrito
        </button>
      </div>
    </>
  );
}

function RaceCard({ race, origin, signup, going, onManual, onOpenMyRaces }) {
  return (
    <Card id={`race-${race.id}`} className="scroll-mt-24">
      <div className="relative h-36 sm:h-48 w-full bg-gray-950 overflow-hidden">
        <img
          src={race.image || FALLBACK_IMAGE}
          alt=""
          loading="lazy"
          onError={(e) => {
            if (e.currentTarget.src !== FALLBACK_IMAGE) e.currentTarget.src = FALLBACK_IMAGE;
          }}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-transparent opacity-80" />

        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-semibold backdrop-blur-md ${distanceTone(race.distanceKm)}`}
            title={`Distancia en línea recta desde ${origin.name}`}
          >
            <Navigation className="w-3 h-3" />
            {race.distanceKm == null ? (race.locationUnknown ? 'Ubicación ?' : 'Localizando…') : race.distanceKm === 0 ? 'Aquí mismo' : `a ${race.distanceKm} km`}
          </span>
        </div>

        {race.price != null && race.price !== '' && (
          <div className="absolute top-3 right-3">
            <Badge variant="price">{race.price}€</Badge>
          </div>
        )}

        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary">
            <Tag className="w-3.5 h-3.5 text-orange-400" />
            <span>{race.discipline}</span>
          </Badge>
          {durationLabel(race) && (
            <Badge variant="secondary" className="!text-sky-200 !border-sky-400/40">
              <Calendar className="w-3.5 h-3.5 text-sky-300" />
              <span>{durationLabel(race)}</span>
            </Badge>
          )}
        </div>
      </div>

      <CardHeader>
        <CardTitle className="line-clamp-2">{race.name}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-500/80 shrink-0" />
          <span>
            {formatRange(race)}
            {race.startTime ? ` · ${race.startTime} h` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-orange-500/80 shrink-0" />
          <span>{race.location}</span>
        </div>
        {(race.distanceText || parseDistancesKm(race).length > 0) && (
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-orange-500/80 shrink-0" />
            <span>{race.distanceText || parseDistancesKm(race).map((d) => `${d} km`).join(' / ')}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="space-y-2">
        <RaceActions race={race} signup={signup} going={going} onManual={onManual} onOpenMyRaces={onOpenMyRaces} />
      </CardFooter>
    </Card>
  );
}

const WHEN_SHORTCUTS = ['weekend', 'nextWeekend', 'month', 'nextMonth', '90d'];

export default function Home() {
  const [races, setRaces] = useState([]);
  const [origin, setOrigin] = useState(loadOrigin);
  const [sortBy, setSortBy] = useState(() => loadView().sortBy); // 'date' | 'distance'
  const [mode, setMode] = useState(() => loadView().mode); // 'list' | 'map'
  // Todos los filtros viven aquí y se muestran como chips en la barra de búsqueda
  const [filters, setFilters] = useState(() => loadView().filters);
  const [attendees, setAttendees] = useState({});
  const [limit, setLimit] = useState(60);
  const user = useCloudUser();

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify({ sortBy, mode, filters }));
    } catch {
      /* ignore */
    }
    setLimit(60);
  }, [sortBy, mode, filters]);
  const [gpsState, setGpsState] = useState({ loading: false, error: '' });
  const [syncState, setSyncState] = useState({ loading: false, message: '' });
  const [dialogRace, setDialogRace] = useState(null);
  const [signups, setSignups] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const load = () => setSignups(Object.fromEntries(getMyRaces().map((m) => [m.raceId, m])));
    load();
    window.addEventListener('myraces:updated', load);
    return () => window.removeEventListener('myraces:updated', load);
  }, []);

  const reload = useCallback(() => {
    let stored = getRaces();
    // la Mitja de Terrassa cambió de dominio (.cat → .org)
    if (stored?.some((r) => /mitjaterrassa\.cat/.test(r.link || ''))) {
      stored = saveRaces(
        stored.map((r) =>
          /mitjaterrassa\.cat/.test(r.link || '') ? { ...r, link: 'https://www.mitjaterrassa.org/', officialUrl: 'https://www.mitjaterrassa.org/' } : r
        )
      );
    }
    if (stored?.length) {
      // limpieza: fuera carreras pasadas y los ejemplos antiguos si ya hay datos reales
      const today = todayLocal();
      const hasReal = stored.some((r) => ['xipgroc', 'runnea', 'spartan', 'ocr'].includes(r.source));
      const clean = stored.filter((r) => !isPast(r, today) && !(hasReal && LEGACY_SEEDS.has(r.id)));
      if (clean.length !== stored.length) stored = saveRaces(clean);
    }
    setRaces(stored || []);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener('races:updated', reload);

    // Sincronización automática desatendida cada 12 h
    setSyncState({ loading: true, message: '' });
    autoSyncIfStale(12)
      .then((r) => setSyncState({ loading: false, message: r ? r.message : '' }))
      .catch(() => setSyncState({ loading: false, message: '' }));
    resolveMissingCoords().catch(() => {});

    // Si el navegador ya tiene permiso de ubicación, usarla sin preguntar
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((p) => p.state === 'granted' && handleGps())
      .catch(() => {});

    return () => window.removeEventListener('races:updated', reload);
  }, [reload]);

  useEffect(() => {
    try {
      localStorage.setItem(ORIGIN_KEY, JSON.stringify(origin));
    } catch {
      /* ignore */
    }
  }, [origin]);

  const handleGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsState({ loading: false, error: 'Tu navegador no soporta geolocalización.' });
      return;
    }
    setGpsState({ loading: true, error: '' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ mode: 'gps', name: 'Mi ubicación', lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsState({ loading: false, error: '' });
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado: se usa la ciudad elegida en «Desde».'
            : 'No se pudo obtener tu ubicación: se usa la ciudad elegida en «Desde».';
        setGpsState({ loading: false, error: msg });
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60 * 1000 }
    );
  };

  const handleOrigin = (value) => {
    if (value === '__gps') return handleGps();
    setOrigin({ mode: 'city', name: value, ...PRESET_LOCATIONS[value] });
  };

  const handleSync = async () => {
    setSyncState({ loading: true, message: '' });
    const r = await importRunneaRaces({ force: true });
    setSyncState({ loading: false, message: r.message });
  };

  const today = todayLocal();

  // Una sola copia de cada carrera (aunque venga de varias webs), solo de hoy en adelante
  const upcoming = useMemo(
    () =>
      dedupeRaces(races)
        .filter((r) => !isPast(r, today))
        .map((r) => ({ ...r, zone: zoneOf(r), distanceKm: calculateDistanceKm(origin.lat, origin.lon, r.lat, r.lon) })),
    [races, origin, today]
  );
  const placeIndex = useMemo(() => buildPlaceIndex(upcoming), [upcoming]);

  const filtered = useMemo(() => {
    const list = upcoming.filter((r) => matchesFilters(r, filters, origin));
    const byDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9);
    if (sortBy === 'distance') {
      return list.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return byDate(a, b);
        if (a.distanceKm == null) return 1; // sin coordenadas al final
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm || byDate(a, b);
      });
    }
    return list.sort(byDate);
  }, [upcoming, filters, origin, sortBy]);

  // Contadores para las pestañas y los atajos (cada uno ignorando su propio filtro)
  const tabCounts = useMemo(() => {
    const c = { all: 0, city: 0, trail: 0, ocr: 0 };
    for (const r of upcoming) {
      if (!matchesFilters(r, filters, origin, { skip: 'category' })) continue;
      c.all++;
      c[categoryOf(r)]++;
    }
    return c;
  }, [upcoming, filters, origin]);

  const shortcuts = useMemo(() => {
    const countWith = (patch, skip) => upcoming.filter((r) => matchesFilters(r, { ...filters, ...patch }, origin, { skip })).length;
    const out = [];
    for (const id of WHEN_SHORTCUTS) {
      const w = whenPreset(id);
      const active = filters.when?.id === id;
      out.push({ key: `w-${id}`, label: w.label, active, count: countWith({ when: w }), onClick: () => setFilters((f) => ({ ...f, when: active ? null : w })) });
    }
    for (const id of DIST_SHORTCUTS[filters.category] || []) {
      const d = DIST_PRESETS[id];
      const active = filters.dist?.id === id;
      out.push({ key: `d-${id}`, label: d.label, active, count: countWith({ dist: d }), onClick: () => setFilters((f) => ({ ...f, dist: active ? null : d })) });
    }
    return out;
  }, [upcoming, filters, origin]);

  // ¿Quién va? (solo con cuenta en la nube)
  const visible = filtered.slice(0, limit);
  const visibleIds = visible.map((r) => r.id).join(',');
  useEffect(() => {
    if (!user || !visibleIds) return;
    const t = setTimeout(() => getAttendees(visibleIds.split(',')).then(setAttendees).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [user, visibleIds]);

  const mapCenter = useMemo(() => {
    const c = placeCenter(filters.place, origin);
    return c ? { ...c, radius: filters.place.radius } : null;
  }, [filters.place, origin]);

  const focusRace = (id) => {
    const i = filtered.findIndex((r) => r.id === id);
    if (i >= limit) setLimit(i + 12);
    setTimeout(() => {
      const el = document.getElementById(`race-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('rc-flash');
      void el.offsetWidth;
      el.classList.add('rc-flash');
    }, 50);
  };

  // Sin resultados: proponer quitar el filtro más restrictivo
  const relax = [];
  if (filters.place?.kind === 'near' && filters.place.radius < 200) {
    const next = RADIUS_STEPS.find((r) => r > filters.place.radius) || 200;
    relax.push([`Ampliar a ${next} km`, () => setFilters((f) => ({ ...f, place: { ...f.place, radius: next } }))]);
  }
  if (filters.when) relax.push(['Cualquier fecha', () => setFilters((f) => ({ ...f, when: null }))]);
  if (filters.dist) relax.push(['Cualquier distancia', () => setFilters((f) => ({ ...f, dist: null }))]);
  if (filters.place && filters.place.kind !== 'near') relax.push(['Toda España', () => setFilters((f) => ({ ...f, place: null }))]);
  if (filters.text) relax.push([`Quitar «${filters.text}»`, () => setFilters((f) => ({ ...f, text: '' }))]);

  const pendingCoords = races.filter((r) => r.lat == null && !r.locationUnknown).length;
  const lastSync = getLastSync();
  const heading = [
    filters.category !== 'all' && { city: 'Carreras de ciudad', trail: 'Trail running', ocr: 'Obstáculos' }[filters.category],
    filters.place && placeLabel(filters.place, origin),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex-1 px-4 py-5 sm:p-6 md:p-10 bg-[#0B0F19] text-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-5">
        <div>
          <Badge variant="default" className="mb-3 hidden sm:inline-flex">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Calendario Oficial 2026</span>
          </Badge>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white tracking-tight">
            Race Connect <span className="text-orange-500">Hub</span>
          </h1>
          <p className="hidden sm:block text-sm text-gray-400 mt-2 max-w-2xl leading-relaxed">
            Escribe lo que buscas como lo dirías: «trail cerca de Terrassa en noviembre», «10K este finde», «obstáculos Cataluña»…
          </p>
        </div>

        <SmartSearchBar
          filters={filters}
          setFilters={setFilters}
          placeIndex={placeIndex}
          origin={origin}
          onNearMe={() => origin.mode !== 'gps' && handleGps()}
          races={upcoming}
          tabCounts={tabCounts}
          shortcuts={shortcuts}
        />

        {/* Barra de resultados: Lista/Mapa · orden · punto de partida */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/10 p-0.5 bg-[#111827]" role="group" aria-label="Vista">
            {[
              ['list', 'Lista', List],
              ['map', 'Mapa', MapIcon],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  mode === id ? 'bg-white text-gray-900' : 'text-gray-300 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSortBy(sortBy === 'date' ? 'distance' : 'date')}
            className="h-10 px-3 rounded-xl border border-white/10 bg-[#111827] text-xs font-semibold text-gray-200 inline-flex items-center gap-1.5 cursor-pointer hover:border-white/30"
            title="Cambiar orden"
          >
            {sortBy === 'date' ? <Calendar className="w-4 h-4 text-orange-400" /> : <ArrowUpDown className="w-4 h-4 text-orange-400" />}
            {sortBy === 'date' ? 'Por fecha' : 'Más cercanas'}
          </button>

          <label className="h-10 pl-3 pr-1 rounded-xl border border-white/10 bg-[#111827] text-xs text-gray-400 inline-flex items-center gap-1.5 min-w-0">
            {gpsState.loading ? <Loader2 className="w-4 h-4 animate-spin text-orange-400" /> : <Navigation className="w-4 h-4 text-orange-400" />}
            <span className="hidden sm:inline">Desde</span>
            <select
              aria-label="Punto de partida"
              value={origin.mode === 'city' ? origin.name : '__gps'}
              onChange={(e) => handleOrigin(e.target.value)}
              className="h-9 bg-transparent text-gray-100 font-semibold focus:outline-none cursor-pointer max-w-[150px]"
            >
              <option value="__gps" className="bg-[#111827]">
                📍 Mi ubicación
              </option>
              {SELECTABLE_CITIES.map((c) => (
                <option key={c} value={c} className="bg-[#111827]">
                  {c}
                </option>
              ))}
            </select>
          </label>

          <span className="ml-auto text-xs text-gray-400">
            <strong className="text-white text-sm">{filtered.length}</strong> carreras
          </span>
        </div>

        {gpsState.error && <p className="text-xs text-red-400 -mt-2">{gpsState.error}</p>}

        {mode === 'map' && (
          <RaceMap
            races={filtered}
            center={mapCenter}
            origin={origin}
            boundsActive={filters.place?.kind === 'bounds'}
            onSearchArea={(bounds) => setFilters((f) => ({ ...f, place: { kind: 'bounds', bounds } }))}
            onSelect={focusRace}
          />
        )}

        {heading && (
          <div className="flex items-center gap-2 pt-1">
            <Trophy className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-bold text-white">{heading}</h2>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-14 border border-dashed border-white/10 rounded-2xl text-sm text-gray-400 px-4">
            <Search className="w-6 h-6 mx-auto mb-3 text-gray-600" />
            <p>No hay carreras con estos filtros.</p>
            {relax.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {relax.map(([label, fn]) => (
                  <button key={label} onClick={fn} className="h-8 px-3 rounded-full border border-orange-500/40 text-orange-300 text-xs font-semibold hover:bg-orange-500/10 cursor-pointer">
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((race) => (
            <RaceCard
              key={race.id}
              race={race}
              origin={origin}
              signup={signups[race.id]}
              going={attendees[race.id]}
              onManual={() => setDialogRace(race)}
              onOpenMyRaces={() => navigate('/my-races')}
            />
          ))}
        </div>

        {filtered.length > visible.length && (
          <div className="text-center">
            <Button variant="secondary" onClick={() => setLimit((l) => l + 60)}>
              Ver más ({filtered.length - visible.length})
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-white/5 text-[11px] text-gray-500">
          <span>
            {syncState.loading
              ? 'Actualizando carreras…'
              : syncState.message || (lastSync ? `Última sincronización: ${new Date(lastSync).toLocaleString('es-ES')}` : 'Sin sincronizar todavía')}
            {pendingCoords > 0 && ` · localizando ${pendingCoords} carreras en el mapa…`}
          </span>
          <button
            onClick={handleSync}
            disabled={syncState.loading}
            className="inline-flex items-center gap-1 text-gray-400 hover:text-white disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${syncState.loading ? 'animate-spin' : ''}`} />
            Actualizar ahora
          </button>
        </div>
      </div>
      {dialogRace && <SignupDialog race={dialogRace} onClose={() => setDialogRace(null)} />}
    </div>
  );
}
