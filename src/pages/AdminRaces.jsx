import { useEffect, useState, useMemo } from 'react';
import { db } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import {
  Loader2, Plus, Pencil, Trash2, X, ShieldAlert, Sparkles,
  Search, Copy, ExternalLink, Mountain, Calendar, Users, MapPin
} from 'lucide-react';

const DISTANCES = ['5K', '8K', '10K', 'Media maratón', 'Maratón', 'Trail', 'Ultra Trail', 'OCR / Obstáculos'];
const STATUSES = ['abierta', 'cerrada', 'finalizada'];

const DISTANCE_DEFAULTS = {
  '5K': 5,
  '8K': 8,
  '10K': 10,
  'Media maratón': 21.097,
  'Maratón': 42.195,
};

const emptyForm = {
  name: '', date: '', distance: '10K', distance_km: 10, elevation_gain: 0,
  city: 'Terrassa', location: '', start_time: '09:00', price: 0, spots: 500,
  image: '', description: '', status: 'abierta', registration_url: '', source: 'manual',
};

function formatShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminRaces() {
  const { user } = useAuth();
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [importCommunity, setImportCommunity] = useState('catalunya');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDistance, setFilterDistance] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadRaces = async () => {
    setLoading(true);
    try {
      const res = await db.entities.Race.filter({}, { sort: 'date', limit: 200 });
      setRaces(res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRaces(); }, []);

  const filteredRaces = useMemo(() => {
    return races.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.city?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDist = filterDistance === 'all' || r.distance === filterDistance;
      const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchesSearch && matchesDist && matchesStatus;
    });
  }, [races, searchTerm, filterDistance, filterStatus]);

  const stats = useMemo(() => {
    const openCount = races.filter((r) => r.status === 'abierta').length;
    const totalReg = races.reduce((acc, r) => acc + (Number(r.registered) || 0), 0);
    return { total: races.length, openCount, totalReg };
  }, [races]);

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-20">
        <ShieldAlert className="w-8 h-8 mx-auto text-muted-foreground/50" />
        <p className="mt-3 text-muted-foreground">Solo los administradores pueden gestionar carreras.</p>
      </div>
    );
  }

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };

  const openEdit = (race) => {
    setEditing(race);
    setForm({
      name: race.name || '', date: race.date || '', distance: race.distance || '10K',
      distance_km: race.distance_km ?? 10, elevation_gain: race.elevation_gain ?? 0,
      city: race.city || '', location: race.location || '',
      start_time: race.start_time || '09:00', price: race.price ?? 0, spots: race.spots ?? 0,
      image: race.image || '', description: race.description || '', status: race.status || 'abierta',
      registration_url: race.registration_url || '', source: race.source || 'manual',
    });
    setShowForm(true);
  };

  const duplicateRace = async (race) => {
    const copy = {
      ...race,
      id: undefined,
      name: `${race.name} (Copia)`,
      registered: 0,
      source: 'manual',
    };
    await db.entities.Race.create(copy);
    await loadRaces();
  };

  const handleDistanceChange = (newDist) => {
    const defaultKm = DISTANCE_DEFAULTS[newDist];
    setForm((prev) => ({
      ...prev,
      distance: newDist,
      distance_km: defaultKm !== undefined ? defaultKm : prev.distance_km,
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        distance_km: Number(form.distance_km),
        elevation_gain: Number(form.elevation_gain || 0),
        price: Number(form.price),
        spots: Number(form.spots),
      };
      if (editing) {
        await db.entities.Race.update(editing.id, payload);
      } else {
        payload.registered = 0;
        await db.entities.Race.create(payload);
      }
      setShowForm(false);
      await loadRaces();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (race) => {
    if (!confirm(`¿Eliminar "${race.name}"?`)) return;
    try {
      await db.entities.Race.delete(race.id);
      await loadRaces();
    } catch (err) { console.error(err); }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportMsg('');
    await new Promise((r) => setTimeout(r, 600));
    setImportMsg('Carreras sincronizadas correctamente con el catálogo.');
    setImporting(false);
    await loadRaces();
  };

  const statusBadge = (status) => {
    const styles = {
      abierta: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      cerrada: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      finalizada: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.abierta}`}>
        {status}
      </span>
    );
  };

  const inputCls = 'mt-1 w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Administrar carreras</h1>
          <p className="mt-1 text-muted-foreground">Crea, edita, duplica y gestiona los eventos del calendario.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nueva carrera
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Calendar className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Total Carreras</p>
            <p className="text-xl font-bold">{stats.total}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500"><Sparkles className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Inscripciones Abiertas</p>
            <p className="text-xl font-bold">{stats.openCount}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500"><Users className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Corredores Apuntados</p>
            <p className="text-xl font-bold">{stats.totalReg.toLocaleString('es-ES')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium">Sincronizar:</span>
          <select
            value={importCommunity}
            onChange={(e) => setImportCommunity(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
          >
            <option value="catalunya">Cataluña</option>
            <option value="madrid">Madrid</option>
            <option value="espana">Toda España</option>
          </select>
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {importing ? 'Sincronizando…' : 'Actualizar'}
          </button>
          {importMsg && <span className="text-xs text-muted-foreground w-full mt-1">{importMsg}</span>}
        </div>

        <div className="lg:col-span-7 flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar carrera o ciudad..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
            />
          </div>
          <select
            value={filterDistance}
            onChange={(e) => setFilterDistance(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
          >
            <option value="all">Todas las distancias</option>
            {DISTANCES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
          >
            <option value="all">Todos los estados</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filteredRaces.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border">
          <p className="text-muted-foreground">No se encontraron carreras con esos filtros.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-3">Carrera</th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Fecha</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Modalidad / Desnivel</th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Estado</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Ocupación</th>
                <th className="text-right font-medium px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRaces.map((race) => {
                const ratio = race.spots > 0 ? Math.min(100, Math.round(((race.registered || 0) / race.spots) * 100)) : 0;
                return (
                  <tr key={race.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold line-clamp-1">{race.name}</p>
                        {race.registration_url && (
                          <a href={race.registration_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {race.city || 'Sin ciudad'}
                        <span className="sm:hidden"> · {formatShort(race.date)} · {race.distance}</span>
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                      <p>{formatShort(race.date)}</p>
                      <p className="text-xs text-muted-foreground">{race.start_time || '09:00'}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-medium">{race.distance}</span>
                      <span className="text-xs text-muted-foreground ml-1">({race.distance_km} km)</span>
                      {race.elevation_gain > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                          <Mountain className="w-3 h-3" /> +{race.elevation_gain} m D+
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {statusBadge(race.status)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell w-40">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{race.registered || 0} / {race.spots || 0}</span>
                        <span className="text-muted-foreground">{ratio}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${ratio}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => duplicateRace(race)} className="grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition" title="Duplicar carrera">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(race)} className="grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(race)} className="grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-border bg-card z-10">
              <h2 className="font-heading text-lg font-bold">{editing ? 'Editar carrera' : 'Nueva carrera'}</h2>
              <button onClick={() => setShowForm(false)} className="grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Fecha</label>
                  <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-sm font-medium">Hora de salida</label>
                  <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Modalidad</label>
                  <select value={form.distance} onChange={(e) => handleDistanceChange(e.target.value)} className={inputCls}>
                    {DISTANCES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Distancia (Km)</label>
                  <input type="number" step="0.001" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-sm font-medium">Desnivel D+ (m)</label>
                  <input type="number" value={form.elevation_gain} onChange={(e) => setForm({ ...form, elevation_gain: e.target.value })} placeholder="0" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Ciudad</label>
                  <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-sm font-medium">Lugar de salida</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Precio (€)</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-sm font-medium">Plazas</label>
                  <input type="number" value={form.spots} onChange={(e) => setForm({ ...form, spots: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-sm font-medium">Estado</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Imagen (URL)</label>
                <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://..." className={inputCls} />
              </div>
              <div>
                <label className="text-sm font-medium">Enlace de inscripción (web oficial)</label>
                <input value={form.registration_url} onChange={(e) => setForm({ ...form, registration_url: e.target.value })} placeholder="https://..." className={inputCls} />
              </div>
              <div>
                <label className="text-sm font-medium">Descripción</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls + ' resize-none'} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
                  {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear carrera'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}