import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, Calendar, MapPin, Trophy, RefreshCw, CheckCircle2,
  ExternalLink, Search, Shield, Plus, Trash2, Mountain, Award,
  LogOut, Link2, Unlink, X, AlertTriangle, Sparkles
} from 'lucide-react';

const STRAVA_CLIENT_ID = '283188';
const ADMIN_LIST = ['joel.botana@gmail.com', 'jobial24'];

// Formateador de fechas al español: "24/01/2027 (dom, 24 ene 2027)"
function formatSpanishDate(dateStr) {
  if (!dateStr) return 'Fecha pendiente';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts.map(Number);
  const dateObj = new Date(year, month - 1, day);
  if (isNaN(dateObj.getTime())) return `${day}/${month}/${year}`;

  const ddmmyyyy = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  const textoCorto = dateObj.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  });
  return `${ddmmyyyy} • ${textoCorto}`;
}

export default function App() {
  // Nueva clave limpia rch_auth_v2 para garantizar que salga la pantalla de Login
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rch_auth_v2');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return null;
  });

  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('explore');
  const [races, setRaces] = useState([]);
  const [loadingRaces, setLoadingRaces] = useState(true);
  const [myRaces, setMyRaces] = useState([]);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [loadingStrava, setLoadingStrava] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [autoDiscoverInput, setAutoDiscoverInput] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('Todas');
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Auto-Actualización Activa');
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [newRace, setNewRace] = useState({
    name: '',
    date: '2027-01-24',
    location: '',
    province: 'Barcelona',
    discipline: 'Running',
    distance_km: 10,
    elevation_m: 100,
    price_eur: 20,
    website_url: ''
  });

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const u = (user.username || '').toLowerCase().trim();
    const e = (user.email || '').toLowerCase().trim();
    return user.role === 'admin' || ADMIN_LIST.includes(u) || ADMIN_LIST.includes(e);
  }, [user]);

  const mapD1Race = (r) => {
    const km = Number(r.distance_km ?? r.distanceKm ?? 10);
    const elev = Number(r.elevation_m ?? 0);
    const price = Number(r.price_eur ?? 0);
    return {
      id: r.id,
      name: r.name || 'Carrera Oficial',
      rawDate: r.date || '2027-01-01',
      dateFormatted: formatSpanishDate(r.date),
      location: r.location || 'España',
      province: r.province || 'España',
      discipline: r.discipline || 'Running',
      distance: `${km} km`,
      distanceKm: km,
      elevation: `+${elev} m`,
      price: price > 0 ? `${price} €` : 'Gratis',
      status: r.status || 'Inscripciones Abiertas',
      image: r.image_url || 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
      url: r.website_url || '#'
    };
  };

  // Cargar y auto-actualizar carreras desde D1
  const fetchRaces = async (reset = false) => {
    setLoadingRaces(true);
    try {
      const params = new URLSearchParams();
      if (user?.email) params.set('email', user.email);
      if (reset) params.set('reset', '1');

      const res = await fetch(`/api/sync-races?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.races)) {
          setRaces(data.races.map(mapD1Race));
          setStatusMsg(`Auto-Sync: ${data.races.length} carreras activas`);
        }
      }
    } catch (e) {
      console.warn('Error cargando carreras:', e);
    } finally {
      setLoadingRaces(false);
    }
  };

  // Cargar datos privados de la persona logueada (sus dorsales y su Strava individual)
  const fetchUserData = async (currentUser) => {
    if (!currentUser?.id || currentUser.id === 'guest') return;
    try {
      const regRes = await fetch(`/api/auth?userId=${encodeURIComponent(currentUser.id)}`);
      if (regRes.ok) {
        const regData = await regRes.json();
        if (regData.ok) setMyRaces(regData.registrations || []);
      }

      setLoadingStrava(true);
      const stravaRes = await fetch(`/api/strava-auth?userId=${encodeURIComponent(currentUser.id)}`);
      if (stravaRes.ok) {
        const stravaData = await stravaRes.json();
        if (stravaData.ok && stravaData.connected) {
          setStravaActivities(stravaData.activities || []);
          const updatedUser = { ...currentUser, stravaConnected: true, stravaAthlete: stravaData.athlete };
          setUser(updatedUser);
          localStorage.setItem('rch_auth_v2', JSON.stringify(updatedUser));
        } else {
          setStravaActivities([]);
        }
      }
    } catch (_) {
    } finally {
      setLoadingStrava(false);
    }
  };

  useEffect(() => {
    fetchRaces();
    if (user) {
      fetchUserData(user);
    }
  }, [user?.id]);

  // Capturar retorno OAuth de Strava (?code=...) para el usuario actual
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code || !user?.id) return;

    window.history.replaceState({}, document.title, window.location.pathname);

    async function linkPersonalStrava() {
      setLoadingStrava(true);
      setActiveTab('strava');
      try {
        const res = await fetch('/api/strava-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, userId: user.id })
        });
        const data = await res.json();
        if (data.ok && data.athlete) {
          const updated = { ...user, stravaConnected: true, stravaAthlete: data.athlete };
          setUser(updated);
          localStorage.setItem('rch_auth_v2', JSON.stringify(updated));
          setStravaActivities(data.activities || []);
          setStatusMsg(`Strava conectado: @${data.athlete.username}`);
        } else {
          alert(data.error || 'Falta STRAVA_CLIENT_SECRET en Cloudflare Pages.');
        }
      } catch (_) {
        alert('Error de red al conectar con Strava.');
      } finally {
        setLoadingStrava(false);
      }
    }

    linkPersonalStrava();
  }, [user?.id]);

  // Login / Registro contra Cloudflare D1
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode,
          username: authForm.username,
          email: authForm.email,
          password: authForm.password
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAuthError(data.error || 'Credenciales incorrectas');
      } else {
        setUser(data.user);
        localStorage.setItem('rch_auth_v2', JSON.stringify(data.user));
      }
    } catch (_) {
      setAuthError('Error conectando con /api/auth en Cloudflare.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setMyRaces([]);
    setStravaActivities([]);
    localStorage.removeItem('rch_auth_v2');
  };

  // Buscador automático que encuentra y añade carreras solas a D1
  const handleAutoDiscoverSubmit = async (e) => {
    e.preventDefault();
    setIsSyncing(true);
    setStatusMsg('Buscando y añadiendo carreras automáticamente...');
    try {
      const res = await fetch('/api/sync-races', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Email': user?.email || 'joel.botana@gmail.com'
        },
        body: JSON.stringify({
          adminEmail: user?.email || 'joel.botana@gmail.com',
          discoverQuery: autoDiscoverInput.trim()
        })
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.races)) {
        setRaces(data.races.map(mapD1Race));
        setAutoDiscoverInput('');
        setStatusMsg(`Catálogo actualizado (${data.races.length} carreras)`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectMyStrava = () => {
    if (!user || user.id === 'guest') {
      alert('Inicia sesión con tu cuenta antes de conectar tu Strava personal.');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin);
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=read,activity:read_all`;
  };

  const handleDisconnectMyStrava = async () => {
    if (!user) return;
    await fetch(`/api/strava-auth?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    const updated = { ...user, stravaConnected: false, stravaAthlete: null };
    setUser(updated);
    localStorage.setItem('rch_auth_v2', JSON.stringify(updated));
    setStravaActivities([]);
  };

  const toggleRegisterRace = async (raceId) => {
    if (!user || user.id === 'guest') {
      alert('Inicia sesión con tu cuenta para guardar inscripciones.');
      return;
    }
    const exists = myRaces.some((mr) => mr.raceId === raceId);
    let bib = 'S/D';
    let targetTime = '--:--';
    if (!exists) {
      bib = window.prompt('Introduce tu número de dorsal (opcional):', '1042') || 'S/D';
      targetTime = window.prompt('Tiempo objetivo (ej. 1:30:00):', '1:30:00') || '--:--';
    }

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle_race',
        userId: user.id,
        raceId,
        bib,
        targetTime
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) setMyRaces(data.registrations || []);
    }
  };

  const handleCreateRaceAdmin = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync-races', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Email': user.email,
          'X-Admin-User': user.username
        },
        body: JSON.stringify({ adminEmail: user.email, race: newRace })
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.races)) {
        setRaces(data.races.map(mapD1Race));
      }
      setShowAdminModal(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteRaceAdmin = async (id) => {
    if (!isAdmin) return;
    setRaces((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/sync-races?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Email': user.email },
      body: JSON.stringify({ adminEmail: user.email, id })
    });
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

  // =========================================================================
  // VISTA 1: PANTALLA DE LOGIN / CREAR CUENTA
  // =========================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-4 font-sans text-slate-100">
        <div className="w-full max-w-md bg-[#111726] border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-[#FC4C02]/15 border border-[#FC4C02]/30 flex items-center justify-center text-[#FC4C02]">
              <Trophy className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              {authMode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}
            </h1>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Sincroniza tus inscripciones y vincula tu cuenta personal de Strava mediante OAuth2.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nombre Visible
                </label>
                <input
                  type="text"
                  required
                  placeholder="jobial24"
                  value={authForm.username}
                  onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-800 text-sm text-white focus:outline-none focus:border-[#FC4C02]"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                placeholder="joel.botana@gmail.com"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-800 text-sm text-white focus:outline-none focus:border-[#FC4C02]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-800 text-sm text-white focus:outline-none focus:border-[#FC4C02]"
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-xl bg-[#FC4C02] hover:bg-[#e04300] text-white font-bold text-sm shadow-lg shadow-[#FC4C02]/25 transition"
            >
              {authLoading
                ? 'Verificando...'
                : authMode === 'register'
                ? 'Crear cuenta'
                : 'Iniciar sesión'}
            </button>
          </form>

          <div className="flex flex-col items-center gap-3 pt-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setAuthError('');
                setAuthMode(authMode === 'register' ? 'login' : 'register');
              }}
              className="text-[#FC4C02] hover:underline font-semibold"
            >
              {authMode === 'register' ? 'Ya tengo cuenta (Iniciar sesión)' : '¿Primera vez? Crear cuenta nueva'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VISTA 2: APLICACIÓN PRINCIPAL
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 font-sans">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B0F17]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FC4C02] to-amber-500 flex items-center justify-center shadow-lg shadow-[#FC4C02]/20">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Race Connect Hub</h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {statusMsg}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Conectado como <strong className="text-white">{user.username}</strong> ({user.email})
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'explore', label: `Calendario (${races.length})`, icon: Calendar },
              { id: 'my-races', label: `Mis Carreras (${myRaces.length})`, icon: Award },
              { id: 'strava', label: 'Mi Strava', icon: Activity }
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

          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <span className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </span>
                <button
                  onClick={() => setShowAdminModal(true)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700"
                >
                  <Plus className="w-4 h-4 text-[#FC4C02]" />
                  <span>Manual</span>
                </button>
                <button
                  onClick={() => fetchRaces(true)}
                  disabled={loadingRaces}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  title="Reparar y sincronizar carreras automáticamente"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingRaces ? 'animate-spin text-[#FC4C02]' : ''}`} />
                </button>
              </>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Cambiar cuenta</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'explore' && (
          <div className="space-y-6">
            {/* Barra de Auto-Descubrimiento Automático de Carreras */}
            <form
              onSubmit={handleAutoDiscoverSubmit}
              className="p-4 rounded-2xl bg-gradient-to-r from-[#FC4C02]/15 via-slate-900 to-slate-900 border border-[#FC4C02]/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#FC4C02]/20 text-[#FC4C02]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Buscador Automático de Carreras (Zero-Touch)</h3>
                  <p className="text-xs text-slate-400">
                    Las carreras de España se actualizan solas. También puedes escribir una ciudad o evento para que el robot lo busque y añada a D1:
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={autoDiscoverInput}
                  onChange={(e) => setAutoDiscoverInput(e.target.value)}
                  placeholder="Ej: Girona, Hyrox Madrid, Trail..."
                  className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-[#FC4C02]"
                />
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="px-4 py-2 rounded-xl bg-[#FC4C02] hover:bg-[#e04300] text-white text-xs font-bold whitespace-nowrap"
                >
                  {isSyncing ? 'Buscando...' : 'Auto-Buscar y Añadir'}
                </button>
              </div>
            </form>

            {/* Filtro de búsqueda local */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/70 p-4 rounded-2xl border border-slate-800/80">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar carreras en pantalla (Terrassa, Barcelona, Sabadell, Valencia...)"
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

            {loadingRaces ? (
              <div className="text-center py-16 text-slate-400 text-sm">
                Sincronizando catálogo automático de carreras...
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
                              title="Eliminar carrera"
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
                            <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                              <Calendar className="w-3.5 h-3.5 text-[#FC4C02]" />
                              {race.dateFormatted}
                            </span>
                            <span className="font-semibold text-emerald-400">{race.price}</span>
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
                          {isRegistered ? 'Inscrito' : 'Apuntarme'}
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
            <h2 className="text-xl font-bold text-white">Inscripciones de {user.username}</h2>
            {myRaces.length === 0 ? (
              <div className="p-10 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 text-sm">
                Aún no tienes carreras guardadas. Apúntate desde el Calendario.
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
                          <p className="text-xs text-amber-300 mt-1">{race.dateFormatted} — {race.location}</p>
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
                          Cancelar inscripción
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
                {user.stravaAthlete?.avatar ? (
                  <img src={user.stravaAthlete.avatar} alt="Strava" className="w-12 h-12 rounded-full border-2 border-[#FC4C02]" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#FC4C02]/20 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-[#FC4C02]" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {user.stravaConnected
                      ? `Strava vinculado a ${user.username}: @${user.stravaAthlete?.username}`
                      : `Vincular Strava personal de ${user.username}`}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {user.stravaConnected
                      ? `${stravaActivities.length} actividades reales sincronizadas de tu cuenta.`
                      : 'Cada usuario que inicia sesión autoriza su propia cuenta de Strava por separado.'}
                  </p>
                </div>
              </div>

              {user.stravaConnected ? (
                <button
                  onClick={handleDisconnectMyStrava}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold"
                >
                  <Unlink className="w-4 h-4" />
                  Desconectar Strava
                </button>
              ) : (
                <button
                  onClick={handleConnectMyStrava}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FC4C02] hover:bg-[#e04300] text-white text-xs font-bold shadow-lg shadow-[#FC4C02]/25"
                >
                  <Link2 className="w-4 h-4" />
                  Conectar con Strava
                </button>
              )}
            </div>

            {loadingStrava ? (
              <div className="text-center py-12 text-slate-400 text-sm">Cargando entrenamientos desde Strava...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stravaActivities.map((act) => (
                  <div key={act.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FC4C02]/20 text-[#FC4C02]">
                        {act.type}
                      </span>
                      <span className="text-xs text-amber-300">{formatSpanishDate(act.date)}</span>
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

      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Añadir Carrera Manual (Admin)</h3>
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
                placeholder="Ubicación (ej. Terrassa, Barcelona)"
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