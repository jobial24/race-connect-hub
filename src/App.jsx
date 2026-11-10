import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, Calendar, MapPin, Trophy, RefreshCw, CheckCircle2,
  ExternalLink, Search, Shield, Plus, Trash2, Mountain, Award,
  UserCheck, LogOut, Link2, Unlink, X, AlertCircle
} from 'lucide-react';

const ADMIN_LIST = ['joel.botana@gmail.com', 'jobial24'];

export default function App() {
  const [activeTab, setActiveTab] = useState('explore');
  const [races, setRaces] = useState([]);
  const [loadingRaces, setLoadingRaces] = useState(true);

  // Usuario actual editable y persistente en localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('rch_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return { username: 'jobial24', email: 'joel.botana@gmail.com' };
  });

  const isAdmin = useMemo(() => {
    const u = (currentUser.username || '').toLowerCase().trim();
    const e = (currentUser.email || '').toLowerCase().trim();
    return ADMIN_LIST.includes(u) || ADMIN_LIST.includes(e);
  }, [currentUser]);

  // Estado de Mis Carreras por usuario
  const [myRaces, setMyRaces] = useState(() => {
    const saved = localStorage.getItem('rch_my_races');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('rch_my_races', JSON.stringify(myRaces));
  }, [myRaces]);

  // Estado real de Strava (guardado en localStorage)
  const [stravaAccount, setStravaAccount] = useState(() => {
    const saved = localStorage.getItem('rch_strava_account');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return null;
  });

  const [stravaActivities, setStravaActivities] = useState(() => {
    const saved = localStorage.getItem('rch_strava_activities');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return [];
  });

  const [stravaConfig, setStravaConfig] = useState(() => {
    const saved = localStorage.getItem('rch_strava_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return { clientId: '', clientSecret: '' };
  });

  // Modales
  const [showUserModal, setShowUserModal] = useState(false);
  const [showStravaModal, setShowStravaModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Formularios
  const [userForm, setUserForm] = useState(currentUser);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('Todas');
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Conectado a Cloudflare D1');

  const [newRace, setNewRace] = useState({
    name: '',
    date: '2026-12-31',
    location: '',
    province: 'Barcelona',
    discipline: 'Running',
    distance_km: 10,
    elevation_m: 100,
    price_eur: 20,
    website_url: '',
    image_url: ''
  });

  // Mapear fila SQL de D1 al formato del frontend
  const mapD1Race = (r) => ({
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
    url: r.website_url || '#'
  });

  // 1. Cargar carreras de Cloudflare D1
  const loadRacesFromD1 = async () => {
    setLoadingRaces(true);
    try {
      const res = await fetch(`/api/sync-races?email=${encodeURIComponent(currentUser.email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.races)) {
          setRaces(data.races.map(mapD1Race));
        }
      }
    } catch (err) {
      console.warn('Error cargando D1:', err);
    } finally {
      setLoadingRaces(false);
    }
  };

  useEffect(() => {
    loadRacesFromD1();
  }, [currentUser.email]);

  // 2. Capturar el retorno de autorización OAuth2 de Strava (?code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Limpiar ?code= de la URL
    window.history.replaceState({}, document.title, window.location.pathname);

    async function completeStravaOAuth() {
      setStatusMsg('Verificando cuenta de Strava...');
      try {
        const savedCfg = JSON.parse(localStorage.getItem('rch_strava_config') || '{}');
        const res = await fetch('/api/strava-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            clientId: savedCfg.clientId,
            clientSecret: savedCfg.clientSecret
          })
        });
        const data = await res.json();
        if (data.ok && data.athlete) {
          setStravaAccount(data.athlete);
          setStravaActivities(data.activities || []);
          localStorage.setItem('rch_strava_account', JSON.stringify(data.athlete));
          localStorage.setItem('rch_strava_activities', JSON.stringify(data.activities || []));
          setActiveTab('strava');
          setStatusMsg(`Strava conectado: ${data.athlete.username}`);
        } else {
          alert(`Error al conectar Strava: ${data.error || 'Revisa tu Client ID y Secret'}`);
        }
      } catch (e) {
        alert('Error de red validando Strava OAuth.');
      }
    }

    completeStravaOAuth();
  }, []);

  // Cambiar de usuario
  const handleSwitchUser = (e) => {
    e.preventDefault();
    const updated = {
      username: userForm.username.trim() || 'invitado',
      email: userForm.email.trim().toLowerCase() || 'invitado@correo.com'
    };
    setCurrentUser(updated);
    localStorage.setItem('rch_user', JSON.stringify(updated));
    setShowUserModal(false);
  };

  // Iniciar OAuth real con Strava
  const handleStartStravaOAuth = (e) => {
    e.preventDefault();
    if (!stravaConfig.clientId.trim() || !stravaConfig.clientSecret.trim()) {
      alert('Introduce tu Client ID y Client Secret de strava.com/settings/api');
      return;
    }
    localStorage.setItem('rch_strava_config', JSON.stringify(stravaConfig));
    const redirectUri = encodeURIComponent(window.location.origin);
    const oauthUrl = `https://www.strava.com/oauth/authorize?client_id=${stravaConfig.clientId.trim()}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=read,activity:read_all`;
    window.location.href = oauthUrl;
  };

  // Desconectar Strava
  const handleDisconnectStrava = () => {
    setStravaAccount(null);
    setStravaActivities([]);
    localStorage.removeItem('rch_strava_account');
    localStorage.removeItem('rch_strava_activities');
  };

  // Importar las 4 carreras próximas del catálogo (solo si tú le das al botón)
  const handleSyncCatalog = async () => {
    if (!isAdmin) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync-races', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Email': currentUser.email,
          'X-Admin-User': currentUser.username
        },
        body: JSON.stringify({ adminEmail: currentUser.email })
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.races)) {
        setRaces(data.races.map(mapD1Race));
        setStatusMsg(`Catálogo sincronizado (${data.races.length} carreras)`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Vaciar todas las carreras de D1
  const handleClearAllRaces = async () => {
    if (!isAdmin) return;
    if (!window.confirm('¿Seguro que quieres borrar todas las carreras actuales de la base de datos D1 para empezar limpio?')) return;
    setRaces([]);
    await fetch('/api/sync-races?id=ALL', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Email': currentUser.email,
        'X-Admin-User': currentUser.username
      },
      body: JSON.stringify({ adminEmail: currentUser.email, id: 'ALL' })
    });
    setStatusMsg('Base de datos D1 vaciada');
  };

  // Crear una carrera personalizada (Admin)
  const handleCreateRaceAdmin = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync-races', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Email': currentUser.email,
          'X-Admin-User': currentUser.username
        },
        body: JSON.stringify({ adminEmail: currentUser.email, race: newRace })
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.races)) {
        setRaces(data.races.map(mapD1Race));
      }
      setShowAdminModal(false);
      setNewRace({
        name: '',
        date: '2026-12-31',
        location: '',
        province: 'Barcelona',
        discipline: 'Running',
        distance_km: 10,
        elevation_m: 100,
        price_eur: 20,
        website_url: '',
        image_url: ''
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Borrar una carrera individual (Admin)
  const handleDeleteRaceAdmin = async (id) => {
    if (!isAdmin) return;
    setRaces((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/sync-races?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Email': currentUser.email,
        'X-Admin-User': currentUser.username
      },
      body: JSON.stringify({ adminEmail: currentUser.email, id })
    });
  };

  const toggleRegisterRace = (raceId) => {
    const exists = myRaces.find((mr) => mr.raceId === raceId);
    if (exists) {
      setMyRaces(myRaces.filter((mr) => mr.raceId !== raceId));
    } else {
      const bib = window.prompt('Introduce tu número de dorsal (opcional):', '1042') || 'S/D';
      const targetTime = window.prompt('Introduce tu tiempo objetivo (ej. 1:30:00):', '1:30:00') || '--:--';
      setMyRaces([...myRaces, { raceId, bib, targetTime }]);
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
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B0F17]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FC4C02] to-amber-500 flex items-center justify-center shadow-lg shadow-[#FC4C02]/20">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Race Connect Hub</h1>
              <p className="text-xs text-slate-400">{statusMsg}</p>
            </div>
          </div>

          {/* Pestañas */}
          <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'explore', label: `Calendario (${races.length})`, icon: Calendar },
              { id: 'my-races', label: `Mis Carreras (${myRaces.length})`, icon: Award },
              { id: 'strava', label: 'Strava', icon: Activity }
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

          {/* Selector de Usuario + Acciones Admin */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setUserForm(currentUser);
                setShowUserModal(true);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                isAdmin
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
              title="Haz clic para cambiar de usuario"
            >
              {isAdmin ? <Shield className="w-4 h-4 text-indigo-400" /> : <UserCheck className="w-4 h-4 text-emerald-400" />}
              <span>{currentUser.username}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30">
                {isAdmin ? 'ADMIN' : 'USER'}
              </span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setShowAdminModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FC4C02] hover:bg-[#e04300] text-xs font-bold text-white transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nueva Carrera</span>
                </button>
                <button
                  onClick={handleClearAllRaces}
                  className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition"
                  title="Vaciar todas las carreras de D1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'explore' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/70 p-4 rounded-2xl border border-slate-800/80">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar carrera o ciudad..."
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

            {filteredRaces.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800/80 space-y-4">
                <p className="text-slate-400 text-sm">
                  {loadingRaces ? 'Cargando carreras desde Cloudflare D1...' : 'No hay carreras en la base de datos ahora mismo.'}
                </p>
                {isAdmin && !loadingRaces && (
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => setShowAdminModal(true)}
                      className="px-4 py-2.5 rounded-xl bg-[#FC4C02] text-white text-xs font-bold"
                    >
                      + Crear mi primera carrera
                    </button>
                    <button
                      onClick={handleSyncCatalog}
                      disabled={isSyncing}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                    >
                      Importar 4 carreras próximas de Cataluña
                    </button>
                  </div>
                )}
              </div>
            ) : (
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
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FC4C02] text-white">
                              {race.discipline}
                            </span>
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-950/80 text-slate-200 border border-slate-700">
                              {race.distance}
                            </span>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteRaceAdmin(race.id)}
                              title="Eliminar carrera (Admin)"
                              className="absolute top-3 right-3 p-1.5 rounded-lg bg-rose-500/80 hover:bg-rose-600 text-white transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <div className="absolute bottom-3 left-3 right-3">
                            <h3 className="text-base font-bold text-white leading-snug">{race.name}</h3>
                          </div>
                        </div>

                        <div className="p-4 space-y-2 text-xs text-slate-300">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-400">
                              <Calendar className="w-3.5 h-3.5 text-[#FC4C02]" />
                              {race.date}
                            </span>
                            <span className="font-semibold text-emerald-400">{race.status}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-400">
                              <MapPin className="w-3.5 h-3.5" />
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
                          {isRegistered ? 'Inscrito (Quitar)' : 'Apuntarme'}
                        </button>
                        {race.url && race.url !== '#' && (
                          <a
                            href={race.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'my-races' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">
              Inscripciones de {currentUser.username}
            </h2>
            {myRaces.length === 0 ? (
              <div className="p-10 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 text-sm">
                Aún no te has apuntado a ninguna carrera desde el Calendario.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myRaces.map((item) => {
                  const race = races.find((r) => r.id === item.raceId);
                  if (!race) return null;
                  return (
                    <div
                      key={item.raceId}
                      className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-[#FC4C02]">{race.discipline} • {race.distance}</span>
                          <h3 className="text-lg font-bold text-white">{race.name}</h3>
                          <p className="text-xs text-slate-400">{race.date} — {race.location}</p>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
                          <span className="text-[10px] text-slate-400 block">DORSAL</span>
                          <span className="text-sm font-mono font-bold text-white">#{item.bib}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800">
                        <span className="text-slate-400">Tiempo Objetivo: <strong className="text-white">{item.targetTime}</strong></span>
                        <button
                          onClick={() => toggleRegisterRace(race.id)}
                          className="text-rose-400 hover:underline"
                        >
                          Desapuntarme
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'strava' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {stravaAccount?.avatar ? (
                  <img src={stravaAccount.avatar} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-[#FC4C02]" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#FC4C02]/20 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-[#FC4C02]" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {stravaAccount ? `Cuenta Strava: ${stravaAccount.firstname} ${stravaAccount.lastname} (@${stravaAccount.username})` : 'Cuenta de Strava no vinculada'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {stravaAccount
                      ? `ID de Atleta Strava: ${stravaAccount.id} • ${stravaActivities.length} actividades reales sincronizadas`
                      : 'Conecta tu cuenta oficial mediante OAuth2 para importar tus entrenamientos y carreras reales.'}
                  </p>
                </div>
              </div>

              {stravaAccount ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowStravaModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
                  >
                    Cambiar Cuenta Strava
                  </button>
                  <button
                    onClick={handleDisconnectStrava}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold"
                  >
                    <Unlink className="w-4 h-4" />
                    Desconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowStravaModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FC4C02] hover:bg-[#e04300] text-white text-xs font-bold shadow-lg shadow-[#FC4C02]/25"
                >
                  <Link2 className="w-4 h-4" />
                  Conectar mi Strava Real
                </button>
              )}
            </div>

            {stravaActivities.length > 0 && (
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Cambiar de Usuario */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Cambiar de Usuario / Cuenta</h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Si usas <strong>jobial24</strong> o <strong>joel.botana@gmail.com</strong> tendrás permisos de Administrador sobre Cloudflare D1. Con cualquier otro nombre entrarás como usuario estándar.
            </p>
            <form onSubmit={handleSwitchUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Nombre de usuario</label>
                <input
                  type="text"
                  required
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserForm({ username: 'jobial24', email: 'joel.botana@gmail.com' })}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Rellenar Admin (Joel)
                </button>
                <button
                  type="button"
                  onClick={() => setUserForm({ username: 'unai_runner', email: 'unai@correo.com' })}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Probar otro usuario
                </button>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#FC4C02] hover:bg-[#e04300] text-white font-bold"
              >
                Guardar y Cambiar Usuario
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Conectar Strava OAuth Real */}
      {showStravaModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#FC4C02]" />
                Vincular Cuenta Oficial de Strava
              </h3>
              <button onClick={() => setShowStravaModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              En <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer" className="text-[#FC4C02] underline">strava.com/settings/api</a>, asegúrate de que en <strong>Authorization Callback Domain</strong> tengas puesto <code>{window.location.hostname}</code>.
            </p>
            <form onSubmit={handleStartStravaOAuth} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Strava Client ID</label>
                <input
                  type="text"
                  placeholder="Ej: 128492"
                  required
                  value={stravaConfig.clientId}
                  onChange={(e) => setStravaConfig({ ...stravaConfig, clientId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Strava Client Secret</label>
                <input
                  type="password"
                  placeholder="Tu Client Secret de Strava"
                  required
                  value={stravaConfig.clientSecret}
                  onChange={(e) => setStravaConfig({ ...stravaConfig, clientSecret: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#FC4C02] hover:bg-[#e04300] text-white font-bold"
              >
                Autorizar en Strava.com
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear Carrera Admin */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Añadir Carrera a Cloudflare D1</h3>
              <button onClick={() => setShowAdminModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRaceAdmin} className="space-y-3 text-xs">
              <input
                type="text"
                placeholder="Nombre de la carrera (ej. Cursa dels Nassos)"
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
                placeholder="Ubicación (ej. Barcelona, Cataluña)"
                required
                value={newRace.location}
                onChange={(e) => setNewRace({ ...newRace, location: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Distancia (km)"
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
              <input
                type="url"
                placeholder="Web oficial (https://...)"
                value={newRace.website_url}
                onChange={(e) => setNewRace({ ...newRace, website_url: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#FC4C02] hover:bg-[#e04300] text-white font-bold"
              >
                Guardar Carrera
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}