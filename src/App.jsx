import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, Calendar, MapPin, Trophy, RefreshCw, CheckCircle2,
  ExternalLink, Search, Shield, Plus, Trash2, Zap, Clock,
  Mountain, ChevronRight, Flame, Award, Terminal, Users, Bike, Footprints, X
} from 'lucide-react';

const INITIAL_RACES = [
  {
    id: 'behobia-ss-2026',
    name: '59ª Behobia - San Sebastián',
    date: '2026-11-08',
    location: 'Donostia / San Sebastián, País Vasco',
    province: 'Gipuzkoa',
    discipline: 'Running',
    distance: '20K',
    distanceKm: 20,
    elevation: '+192m',
    price: '50€',
    status: 'Finalizada / Resultados Oficiales',
    image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
    url: 'https://www.behobia-sansebastian.com',
    autoSynced: true
  },
  {
    id: 'jean-bouin-2026',
    name: '103ª Allianz Jean Bouin Barcelona',
    date: '2026-11-29',
    location: 'Barcelona, Cataluña',
    province: 'Barcelona',
    discipline: 'Running',
    distance: '10K',
    distanceKm: 10,
    elevation: '+140m',
    price: '19€',
    status: 'Inscripciones Abiertas',
    image: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=80',
    url: 'https://www.jeanbouin.mundodeportivo.com',
    autoSynced: true
  },
  {
    id: 'spartan-tenerife-2026',
    name: 'Spartan Race Tenerife Trifecta Weekend',
    date: '2026-12-05',
    location: 'Puerto de la Cruz, Tenerife',
    province: 'Santa Cruz de Tenerife',
    discipline: 'OCR / Spartan',
    distance: '21K',
    distanceKm: 21,
    elevation: '+1150m',
    price: '105€',
    status: 'Últimos Dorsales',
    image: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80',
    url: 'https://es.spartan.com',
    autoSynced: true
  },
  {
    id: 'nassos-bcn-2026',
    name: 'Cursa dels Nassos Barcelona',
    date: '2026-12-31',
    location: 'Barcelona, Cataluña',
    province: 'Barcelona',
    discipline: 'Running',
    distance: '10K',
    distanceKm: 10,
    elevation: '+45m',
    price: '18€',
    status: 'Inscripciones Abiertas',
    image: 'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?auto=format&fit=crop&w=800&q=80',
    url: 'https://www.cursadenassos.barcelona',
    autoSynced: true
  },
  {
    id: 'mitja-terrassa-2027',
    name: 'Mitja Marató Internacional de Terrassa',
    date: '2027-01-24',
    location: 'Terrassa, Cataluña',
    province: 'Barcelona',
    discipline: 'Running',
    distance: '21.1K',
    distanceKm: 21.097,
    elevation: '+260m',
    price: '24€',
    status: 'Inscripciones Abiertas',
    image: 'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=800&q=80',
    url: 'https://mitjaterrassa.org',
    autoSynced: true
  },
  {
    id: 'mitja-barcelona-2027',
    name: 'eDreams Mitja Marató Barcelona by Brooks',
    date: '2027-02-14',
    location: 'Barcelona, Cataluña',
    province: 'Barcelona',
    discipline: 'Running',
    distance: '21.1K',
    distanceKm: 21.097,
    elevation: '+85m',
    price: '36€',
    status: 'Inscripciones Abiertas',
    image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=800&q=80',
    url: 'https://www.edreamsmitjabarcelona.com',
    autoSynced: true
  },
  {
    id: 'valencia-half-2027',
    name: 'Medio Maratón Valencia Trinidad Alfonso Zurich',
    date: '2027-10-24',
    location: 'Valencia, C. Valenciana',
    province: 'Valencia',
    discipline: 'Running',
    distance: '21.1K',
    distanceKm: 21.097,
    elevation: '+35m',
    price: '45€',
    status: 'Lista de Espera / Transferencia',
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80',
    url: 'https://www.valenciaciudaddelrunning.com',
    autoSynced: true
  }
];

const INITIAL_STRAVA_ACTIVITIES = [
  {
    id: 'strava-behobia-2026',
    name: '59ª Behobia - San Sebastián (Oficial)',
    date: '2026-11-08',
    type: 'Run',
    distanceKm: 20.05,
    movingTime: '1:28:42',
    pace: '4:25 /km',
    elevation: 194,
    heartRate: 174,
    gear: 'Adidas Adizero Boston 13',
    matchedRaceId: 'behobia-ss-2026'
  },
  {
    id: 'strava-spartan-2026',
    name: 'Spartan Race Beast 21K',
    date: '2026-10-17',
    type: 'OCR',
    distanceKm: 21.4,
    movingTime: '2:48:15',
    pace: '7:51 /km',
    elevation: 1120,
    heartRate: 168,
    gear: 'Craft Spartan / NNormal Tomir 2.0',
    matchedRaceId: null
  },
  {
    id: 'strava-rodaje-vallparadis',
    name: 'Series Parc de Vallparadís + B-120',
    date: '2026-11-04',
    type: 'Run',
    distanceKm: 12.2,
    movingTime: '53:10',
    pace: '4:21 /km',
    elevation: 115,
    heartRate: 162,
    gear: 'Adidas Adizero Boston 13',
    matchedRaceId: null
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('explore');
  const [races, setRaces] = useState(INITIAL_RACES);
  const [myRaces, setMyRaces] = useState([
    {
      raceId: 'behobia-ss-2026',
      bib: '14892',
      targetTime: '1:29:00',
      completed: true,
      officialTime: '1:28:42',
      pace: '4:25 /km',
      stravaVerified: true
    },
    {
      raceId: 'spartan-tenerife-2026',
      bib: '4021',
      targetTime: '2:45:00',
      completed: false,
      officialTime: null,
      pace: null,
      stravaVerified: false
    },
    {
      raceId: 'mitja-terrassa-2027',
      bib: '814',
      targetTime: '1:32:00',
      completed: false,
      officialTime: null,
      pace: null,
      stravaVerified: false
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('Todas');
  const [stravaConnected, setStravaConnected] = useState(true);
  const [stravaActivities, setStravaActivities] = useState(INITIAL_STRAVA_ACTIVITIES);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncText, setLastSyncText] = useState('Sincronizado con Cloudflare D1');
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [adminUser] = useState({
    username: 'jobial24',
    email: 'joel.botana@gmail.com',
    isAdmin: true
  });

  const [newRace, setNewRace] = useState({
    name: '',
    date: '2027-04-10',
    location: '',
    province: 'Barcelona',
    discipline: 'Running',
    distance_km: 10,
    elevation_m: 100,
    price_eur: 20,
    website_url: ''
  });

  // Cargar carreras desde Cloudflare D1 al abrir la web
  useEffect(() => {
    async function fetchD1Races() {
      try {
        const res = await fetch('/api/sync-races?email=joel.botana@gmail.com');
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && Array.isArray(data.races) && data.races.length > 0) {
          setRaces(
            data.races.map((r) => ({
              id: r.id,
              name: r.name,
              date: r.date,
              location: r.location,
              province: r.province || 'España',
              discipline: r.discipline || 'Running',
              distance: `${r.distance_km}K`,
              distanceKm: Number(r.distance_km),
              elevation: `+${r.elevation_m || 0}m`,
              price: `${r.price_eur || 0}€`,
              status: r.status || 'Inscripciones Abiertas',
              image: r.image_url || 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
              url: r.website_url || '#',
              autoSynced: true
            }))
          );
          if (data.lastSync?.run_at) {
            setLastSyncText(`D1 Sync: ${data.lastSync.run_at} UTC`);
          }
        }
      } catch (e) {
        console.warn('Modo local activo:', e);
      }
    }
    fetchD1Races();
  }, []);

  // Sincronización Zero-Touch contra Cloudflare D1
  const triggerCloudflareSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync-races', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Email': adminUser.email,
          'X-Admin-User': adminUser.username
        },
        body: JSON.stringify({ adminEmail: adminUser.email })
      });
      if (res.ok) {
        const getRes = await fetch('/api/sync-races?email=joel.botana@gmail.com');
        const data = await getRes.json();
        if (data.ok && Array.isArray(data.races)) {
          setRaces(
            data.races.map((r) => ({
              id: r.id,
              name: r.name,
              date: r.date,
              location: r.location,
              province: r.province || 'España',
              discipline: r.discipline || 'Running',
              distance: `${r.distance_km}K`,
              distanceKm: Number(r.distance_km),
              elevation: `+${r.elevation_m || 0}m`,
              price: `${r.price_eur || 0}€`,
              status: r.status || 'Inscripciones Abiertas',
              image: r.image_url,
              url: r.website_url,
              autoSynced: true
            }))
          );
        }
        setLastSyncText(`Actualizado hoy a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`);
      }
    } catch (_) {
      setLastSyncText(`Sincronizado local (${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})`);
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  // Añadir carrera como Admin en D1
  const handleCreateRaceAdmin = async (e) => {
    e.preventDefault();
    if (!newRace.name || !newRace.location) return;
    setIsSyncing(true);
    const id = `${newRace.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${newRace.date.slice(0, 4)}`;
    const raceObj = { ...newRace, id };

    try {
      await fetch('/api/sync-races', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Email': adminUser.email,
          'X-Admin-User': adminUser.username
        },
        body: JSON.stringify({ adminEmail: adminUser.email, race: raceObj })
      });
    } catch (_) {}

    setRaces((prev) => [
      ...prev,
      {
        id,
        name: newRace.name,
        date: newRace.date,
        location: newRace.location,
        province: newRace.province,
        discipline: newRace.discipline,
        distance: `${newRace.distance_km}K`,
        distanceKm: Number(newRace.distance_km),
        elevation: `+${newRace.elevation_m}m`,
        price: `${newRace.price_eur}€`,
        status: 'Inscripciones Abiertas',
        image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
        url: newRace.website_url || '#',
        autoSynced: true
      }
    ]);
    setShowAdminModal(false);
    setIsSyncing(false);
  };

  // Eliminar carrera como Admin en D1
  const handleDeleteRaceAdmin = async (id) => {
    setRaces((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(`/api/sync-races?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Email': adminUser.email,
          'X-Admin-User': adminUser.username
        },
        body: JSON.stringify({ adminEmail: adminUser.email, id })
      });
    } catch (_) {}
  };

  const toggleRegisterRace = (raceId) => {
    const exists = myRaces.find((mr) => mr.raceId === raceId);
    if (exists) {
      setMyRaces(myRaces.filter((mr) => mr.raceId !== raceId));
    } else {
      setMyRaces([
        ...myRaces,
        {
          raceId,
          bib: String(Math.floor(1000 + Math.random() * 9000)),
          targetTime: '1:35:00',
          completed: false,
          officialTime: null,
          pace: null,
          stravaVerified: false
        }
      ]);
    }
  };

  const filteredRaces = useMemo(() => {
    return races.filter((r) => {
      const matchesDiscipline = selectedDiscipline === 'Todas' || r.discipline === selectedDiscipline;
      const matchesQuery =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDiscipline && matchesQuery;
    });
  }, [races, selectedDiscipline, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 font-sans">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B0F17]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FC4C02] to-amber-500 flex items-center justify-center shadow-lg shadow-[#FC4C02]/20">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Race Connect Hub</h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  D1 Auto-Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">{lastSyncText}</p>
            </div>
          </div>

          {/* Navegación central */}
          <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'explore', label: 'Calendario', icon: Calendar },
              { id: 'my-races', label: `Mis Carreras (${myRaces.length})`, icon: Award },
              { id: 'strava', label: 'Strava & Gear', icon: Activity }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-[#FC4C02] text-white shadow-md shadow-[#FC4C02]/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Controles Admin + Strava + Sync */}
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>Admin: {adminUser.username}</span>
            </div>

            <button
              onClick={() => setShowAdminModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition"
            >
              <Plus className="w-4 h-4 text-[#FC4C02]" />
              <span>Añadir Carrera</span>
            </button>

            <button
              onClick={triggerCloudflareSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FC4C02] hover:bg-[#e04300] text-xs font-semibold text-white shadow-lg shadow-[#FC4C02]/20 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sync D1'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'explore' && (
          <div className="space-y-6">
            {/* Buscador y Filtros */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/70 p-4 rounded-2xl border border-slate-800/80">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por carrera o ciudad (ej. Terrassa, Barcelona, Behobia, Valencia...)"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FC4C02]"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['Todas', 'Running', 'OCR / Spartan', 'Trail', 'Ciclismo'].map((disc) => (
                  <button
                    key={disc}
                    onClick={() => setSelectedDiscipline(disc)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                      selectedDiscipline === disc
                        ? 'bg-white text-slate-950'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {disc}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de Carreras */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRaces.map((race) => {
                const isRegistered = myRaces.some((mr) => mr.raceId === race.id);
                return (
                  <div
                    key={race.id}
                    className="group bg-slate-900/80 border border-slate-800/90 rounded-2xl overflow-hidden hover:border-[#FC4C02]/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-44 overflow-hidden">
                        <img
                          src={race.image}
                          alt={race.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                        <div className="absolute top-3 left-3 flex gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FC4C02] text-white shadow">
                            {race.discipline}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-950/80 text-slate-200 border border-slate-700">
                            {race.distance}
                          </span>
                        </div>
                        {adminUser.isAdmin && (
                          <button
                            onClick={() => handleDeleteRaceAdmin(race.id)}
                            title="Eliminar carrera (Admin)"
                            className="absolute top-3 right-3 p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <div className="absolute bottom-3 left-3 right-3">
                          <h3 className="text-base font-bold text-white leading-snug">{race.name}</h3>
                        </div>
                      </div>

                      <div className="p-4 space-y-2.5 text-xs text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-[#FC4C02]" />
                            {race.date}
                          </span>
                          <span className="font-semibold text-emerald-400">{race.status}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {race.location}
                          </span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Mountain className="w-3.5 h-3.5" />
                            {race.elevation}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 pt-0 flex items-center gap-2">
                      <button
                        onClick={() => toggleRegisterRace(race.id)}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          isRegistered
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-[#FC4C02] hover:bg-[#e04300] text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isRegistered ? 'Inscrito en Mis Carreras' : 'Apuntarme'}
                      </button>
                      <a
                        href={race.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'my-races' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Mis Dorsales y Próximos Objetivos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myRaces.map((item) => {
                const race = races.find((r) => r.id === item.raceId);
                if (!race) return null;
                return (
                  <div
                    key={item.raceId}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-[#FC4C02] uppercase">{race.discipline} • {race.distance}</span>
                        <h3 className="text-lg font-bold text-white mt-0.5">{race.name}</h3>
                        <p className="text-xs text-slate-400 mt-1">{race.date} — {race.location}</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
                        <span className="text-[10px] text-slate-400 block">DORSAL</span>
                        <span className="text-sm font-mono font-bold text-white">#{item.bib}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
                      <div>
                        <span className="text-slate-500 block">Objetivo</span>
                        <span className="font-bold text-slate-200">{item.targetTime}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Tiempo Oficial</span>
                        <span className="font-bold text-emerald-400">{item.officialTime || 'Pendiente'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Ritmo Strava</span>
                        <span className="font-bold text-[#FC4C02]">{item.pace || '--:--'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'strava' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-gradient-to-r from-[#FC4C02]/20 via-slate-900 to-slate-900 border border-[#FC4C02]/40 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#FC4C02]" />
                  <h2 className="text-lg font-bold text-white">Strava OAuth2 & Telemetría Garmin</h2>
                </div>
                <p className="text-xs text-slate-300">
                  Sincronizando actividades de Garmin Fénix 7X Pro Solar y Edge 540 con cruce automático de carreras.
                </p>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-[#FC4C02] text-white text-xs font-bold">
                Conectado como @jobial24
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stravaActivities.map((act) => (
                <div key={act.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FC4C02]/20 text-[#FC4C02]">
                      {act.type}
                    </span>
                    <span className="text-xs text-slate-400">{act.date}</span>
                  </div>
                  <h3 className="font-bold text-white text-sm">{act.name}</h3>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-800">
                    <div>
                      <span className="text-slate-500 block">Distancia</span>
                      <span className="font-bold text-white">{act.distanceKm} km</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tiempo</span>
                      <span className="font-bold text-white">{act.movingTime}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Ritmo</span>
                      <span className="font-bold text-emerald-400">{act.pace}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">Zapatillas: {act.gear}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal Admin para añadir carrera a D1 */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#FC4C02]" />
                Añadir Carrera a Cloudflare D1 (Admin)
              </h3>
              <button onClick={() => setShowAdminModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRaceAdmin} className="space-y-3 text-xs">
              <input
                type="text"
                placeholder="Nombre de la carrera"
                required
                value={newRace.name}
                onChange={(e) => setNewRace({ ...newRace, name: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={newRace.date}
                  onChange={(e) => setNewRace({ ...newRace, date: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
                <select
                  value={newRace.discipline}
                  onChange={(e) => setNewRace({ ...newRace, discipline: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option>Running</option>
                  <option>OCR / Spartan</option>
                  <option>Trail</option>
                  <option>Ciclismo</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Ciudad / Ubicación (ej. Terrassa, Cataluña)"
                required
                value={newRace.location}
                onChange={(e) => setNewRace({ ...newRace, location: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Km"
                  value={newRace.distance_km}
                  onChange={(e) => setNewRace({ ...newRace, distance_km: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
                <input
                  type="number"
                  placeholder="Desnivel (m)"
                  value={newRace.elevation_m}
                  onChange={(e) => setNewRace({ ...newRace, elevation_m: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
                <input
                  type="number"
                  placeholder="Precio (€)"
                  value={newRace.price_eur}
                  onChange={(e) => setNewRace({ ...newRace, price_eur: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#FC4C02] hover:bg-[#e04300] text-white font-bold"
              >
                Guardar en Cloudflare D1
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}