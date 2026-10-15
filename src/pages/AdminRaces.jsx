import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  Trash2,
  ExternalLink,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Link2,
  FileText,
  KeyRound,
  Loader2,
  Server,
  Globe,
  SearchCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { importRunneaRaces } from '@/services/runneaSync';
import { getRaces, upsertRace, deleteRace, FALLBACK_IMAGE } from '@/services/raceStore';
import {
  extractRaceWithAI,
  getAiSettings,
  saveAiSettings,
  getServerStatus,
  getServerSettings,
  saveServerSettings,
  testAI,
  DEFAULT_MODEL,
  findOfficialWebAI,
  applyWebFinding,
} from '@/services/aiRaceService';
import { lookupPreset } from '@/lib/places';

const EMPTY_FORM = {
  id: '',
  name: '',
  discipline: 'Trail running',
  price: '',
  date: '',
  endDate: '',
  location: '',
  distanceText: '',
  image: '',
  link: '',
  lat: '',
  lon: '',
  description: '',
  source: 'manual',
};

const selectCls =
  'flex h-10 w-full rounded-xl border border-white/10 bg-[#0B0F19]/60 px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none';

function Notice({ notice }) {
  if (!notice) return null;
  const ok = notice.type !== 'error';
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <div
      className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
        ok ? 'bg-white/5 border-white/10 text-orange-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-px" />
      <div className="space-y-1">
        <p>{notice.text}</p>
        {notice.details?.length > 0 && (
          <ul className="text-[11px] text-gray-400 list-disc pl-4">
            {notice.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AdminRaces() {
  const [races, setRaces] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [server, setServer] = useState({ online: null, ai: false });

  const [aiMode, setAiMode] = useState('search'); // 'search' | 'url' | 'text'
  const [checkingId, setCheckingId] = useState(null); // carrera en revisión con IA
  const [bulk, setBulk] = useState(null); // {done, total}
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiSettings, setAiSettings] = useState(() => {
    getAiSettings(); // limpia keys antiguas guardadas en el navegador
    return { provider: '', apiKey: '', model: '' };
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const formRef = useRef(null);

  const loadData = () => setRaces(getRaces() || []);

  useEffect(() => {
    loadData();
    getServerStatus().then(setServer);
    window.addEventListener('races:updated', loadData);
    return () => window.removeEventListener('races:updated', loadData);
  }, []);

  const flash = (n, ms = 6000) => {
    setNotice(n);
    if (ms) setTimeout(() => setNotice((cur) => (cur === n ? null : cur)), ms);
  };

  const handleSync = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const r = await importRunneaRaces({ force: true });
      flash({ type: r.ok ? 'ok' : 'error', text: r.message, details: r.errors }, r.ok ? 6000 : 0);
    } catch (err) {
      flash({ type: 'error', text: `Error al sincronizar: ${err.message}` }, 0);
    } finally {
      setSyncing(false);
    }
  };

  const handleExtract = async () => {
    const value = aiInput.trim();
    if (!value) return;
    if (aiMode === 'url' && !/^https?:\/\//i.test(value)) {
      flash({ type: 'error', text: 'Introduce una URL completa (https://…).' });
      return;
    }
    setAiLoading(true);
    setNotice(null);
    try {
      const race = await extractRaceWithAI(
        aiMode === 'url' ? { url: value } : aiMode === 'search' ? { query: value } : { text: value }
      );
      setForm({
        ...EMPTY_FORM,
        ...Object.fromEntries(Object.entries(race).map(([k, v]) => [k, v ?? ''])),
        id: '',
        source: 'ai',
      });
      flash({ type: 'ok', text: 'Ficha generada con IA. Revisa los campos y pulsa “Guardar y publicar”.' });
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err) {
      flash({ type: 'error', text: err.message }, 0);
    } finally {
      setAiLoading(false);
    }
  };

  const hostOf = (u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return u || '—';
    }
  };

  // Busca con Gemini + Google la web oficial actual de UNA carrera
  const checkWeb = async (race, { quiet = false } = {}) => {
    setCheckingId(race.id);
    try {
      const f = await findOfficialWebAI(race, { force: true });
      const updated = applyWebFinding(race, f);
      upsertRace({ ...updated, webCheckedAt: f.at });
      if (!quiet) {
        const changed = updated.link !== race.link;
        flash(
          {
            type: changed || f.officialUrl ? 'ok' : 'error',
            text: changed
              ? `${race.name}: web actualizada ${hostOf(race.link)} → ${hostOf(updated.link)}${f.verified ? ' (verificada)' : ''}.`
              : f.officialUrl
              ? `${race.name}: la web ${hostOf(updated.link)} es correcta${f.verified ? ' (verificada)' : ''}.`
              : `${race.name}: la IA no encontró una web oficial fiable.`,
            details: [f.notes, ...(f.rejected || []).map((r) => `Descartada: ${r}`)].filter(Boolean),
          },
          changed ? 8000 : 0
        );
      }
      return updated.link !== race.link;
    } catch (err) {
      if (!quiet) flash({ type: 'error', text: err.message }, 0);
      throw err;
    } finally {
      setCheckingId(null);
    }
  };

  // Revisa en lote las próximas carreras aún no revisadas (cuota gratuita: de 10 en 10)
  const handleBulkCheck = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const todo = races
      .filter((r) => !r.webCheckedAt && (!r.date || r.date >= today))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 10);
    if (!todo.length) {
      flash({ type: 'ok', text: 'Todas las próximas carreras ya están revisadas.' });
      return;
    }
    let changed = 0;
    const errors = [];
    setBulk({ done: 0, total: todo.length });
    for (const [i, r] of todo.entries()) {
      try {
        if (await checkWeb(r, { quiet: true })) changed++;
      } catch (e) {
        errors.push(`${r.name}: ${e.message}`);
        if (/cuota|API key/i.test(e.message)) break;
      }
      setBulk({ done: i + 1, total: todo.length });
    }
    setBulk(null);
    flash(
      { type: errors.length && !changed ? 'error' : 'ok', text: `Revisadas ${todo.length} carreras · ${changed} webs corregidas.`, details: errors },
      errors.length ? 0 : 8000
    );
  };

  const [serverAi, setServerAi] = useState(null); // {provider, providerLabel, key (enmascarada), source, model, providers}
  const [aiTest, setAiTest] = useState(null); // {loading} | {ok, model} | {ok:false, error}

  useEffect(() => {
    getServerSettings()
      .then((s) => {
        setServerAi(s);
        setAiSettings((a) => ({ ...a, provider: s.provider || 'gemini', model: s.model || '' }));
      })
      .catch(() => setServerAi(null));
  }, []);

  const runAiTest = async (opts = {}) => {
    setAiTest({ loading: true });
    setAiTest(await testAI(opts));
  };

  const handleSaveSettings = async () => {
    try {
      const saved = await saveServerSettings({
        provider: aiSettings.provider,
        apiKey: aiSettings.apiKey ? aiSettings.apiKey.trim() : undefined,
        model: aiSettings.model,
      });
      setServerAi(saved);
      setAiSettings({ provider: saved.provider, apiKey: '', model: saved.model || '' });
      getServerStatus().then(setServer);
      flash({ type: 'ok', text: 'Ajustes de IA guardados en el servidor: se mantienen aunque cambies de navegador o reinicies.' });
      runAiTest();
    } catch (e) {
      flash({ type: 'error', text: e.message }, 0);
    }
  };

  const handleCreateRace = (e) => {
    e.preventDefault();
    if (!form.name || !form.date) return;

    let lat = form.lat === '' ? null : Number(form.lat);
    let lon = form.lon === '' ? null : Number(form.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const preset = lookupPreset(form.location);
      lat = preset?.lat ?? null;
      lon = preset?.lon ?? null;
    }

    upsertRace({
      id: form.id || `${form.source}-${Date.now()}`,
      source: form.source || 'manual',
      name: form.name.trim(),
      discipline: form.discipline,
      price: form.price === '' ? null : Number(form.price),
      date: form.date,
      endDate: form.endDate && form.endDate > form.date ? form.endDate : '',
      location: form.location.trim() || 'Cataluña',
      distanceText: form.distanceText.trim(),
      image: form.image.trim() || FALLBACK_IMAGE,
      link: form.link.trim() || '#',
      description: form.description?.trim() || '',
      lat,
      lon,
    });
    flash({ type: 'ok', text: `“${form.name}” publicada en el calendario.` });
    setForm(EMPTY_FORM);
  };

  const handleEdit = (r) => {
    setForm({ ...EMPTY_FORM, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])) });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const counts = races.reduce((acc, r) => ({ ...acc, [r.source || 'otros']: (acc[r.source || 'otros'] || 0) + 1 }), {});

  return (
    <div className="flex-1 px-4 py-5 sm:p-6 md:p-10 max-w-6xl mx-auto w-full space-y-8 bg-[#0B0F19] min-h-screen text-gray-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111827] border border-white/10 rounded-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Administración y Sincronización</h1>
          <p className="text-gray-400 text-xs">
            Actualiza el calendario desde todas las fuentes, crea fichas con el asistente IA o añádelas a mano.
          </p>
          <p className="text-[11px] mt-2 flex items-center gap-1.5 text-gray-500">
            <Server className="w-3 h-3" />
            {server.online === null
              ? 'Comprobando backend local…'
              : server.online
              ? `Servidor activo · Asistente IA ${server.ai ? `conectado (${serverAi?.providerLabel || server.aiProvider})` : 'sin configurar'}`
              : 'Backend local no disponible (arranca con npm run dev)'}
          </p>
        </div>

        <Button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 px-5">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Sincronizando…' : 'Sincronizar carreras'}</span>
        </Button>
      </div>

      <Notice notice={notice} />

      {/* Ingesta con IA */}
      <section className="bg-[#111827] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-semibold text-white">Asistente IA: añadir carreras</h2>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShowSettings((s) => !s)}>
            <KeyRound className="w-3.5 h-3.5" />
            Configurar IA
          </Button>
        </div>

        {showSettings && (
          <div className="space-y-3 p-4 rounded-xl bg-black/20 border border-white/5">
            <p className="text-xs text-gray-400">
              Ahora:{' '}
              <strong className="text-gray-200">
                {serverAi?.key
                  ? `${serverAi.providerLabel} · ${serverAi.key} (${serverAi.source === 'env' ? 'del .env' : 'guardada en el servidor'})`
                  : 'sin configurar'}
              </strong>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_200px_auto] gap-3 items-end">
              <div>
                <Label htmlFor="aiprov">Proveedor</Label>
                <select
                  id="aiprov"
                  value={aiSettings.provider || 'gemini'}
                  onChange={(e) => setAiSettings({ ...aiSettings, provider: e.target.value, model: '' })}
                  className={selectCls}
                >
                  {(serverAi?.providers || [
                    { id: 'gemini', label: 'Google Gemini' },
                    { id: 'openai', label: 'OpenAI (ChatGPT)' },
                    { id: 'anthropic', label: 'Anthropic (Claude)' },
                  ]).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="apikey">API key</Label>
                <Input
                  id="apikey"
                  type="password"
                  autoComplete="off"
                  value={aiSettings.apiKey}
                  onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                  placeholder={
                    serverAi?.key && aiSettings.provider === serverAi.provider
                      ? 'Déjalo vacío para mantener la actual'
                      : serverAi?.providers?.find((p) => p.id === (aiSettings.provider || 'gemini'))?.keyHint || ''
                  }
                />
              </div>
              <div>
                <Label htmlFor="model">Modelo (opcional)</Label>
                <Input
                  id="model"
                  value={aiSettings.model}
                  onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                  placeholder="El recomendado"
                />
              </div>
              <Button onClick={handleSaveSettings}>Guardar</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  runAiTest({ provider: aiSettings.provider, apiKey: aiSettings.apiKey.trim() || undefined, model: aiSettings.model || undefined })
                }
                disabled={aiTest?.loading}
              >
                {aiTest?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Probar conexión
              </Button>
              {aiTest && !aiTest.loading && (
                <span className={`text-xs ${aiTest.ok ? 'text-emerald-400' : 'text-red-300'}`}>
                  {aiTest.ok ? `✓ ${aiTest.provider} responde (${aiTest.model})` : aiTest.error}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              Sirve cualquiera de los tres: Google Gemini, OpenAI o Anthropic (Claude). La key se guarda solo en el servidor
              (.cache/settings.json) y no se borra al cambiar de navegador.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Button variant={aiMode === 'search' ? 'default' : 'secondary'} size="sm" className="gap-1.5" onClick={() => setAiMode('search')}>
            <SearchCheck className="w-3.5 h-3.5" /> Buscar en la web
          </Button>
          <Button variant={aiMode === 'url' ? 'default' : 'secondary'} size="sm" className="gap-1.5" onClick={() => setAiMode('url')}>
            <Link2 className="w-3.5 h-3.5" /> Desde URL
          </Button>
          <Button variant={aiMode === 'text' ? 'default' : 'secondary'} size="sm" className="gap-1.5" onClick={() => setAiMode('text')}>
            <FileText className="w-3.5 h-3.5" /> Pegar texto
          </Button>
        </div>

        {aiMode === 'search' ? (
          <Input
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
            placeholder="Nombre de la carrera, ej. Mitja Marató de Terrassa 2027"
          />
        ) : aiMode === 'url' ? (
          <Input
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
            placeholder="https://web-oficial-de-la-carrera.com/inscripciones"
          />
        ) : (
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            rows={6}
            placeholder="Pega aquí el texto de la ficha, el post de Instagram, el reglamento…"
            className="w-full rounded-xl border border-white/10 bg-[#0B0F19]/60 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-orange-500 focus:outline-none"
          />
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-500">
            {aiMode === 'search'
              ? 'La IA busca en internet la web oficial actual, la verifica y rellena el formulario. Revisa antes de guardar.'
              : 'La IA rellena el formulario de abajo; nada se publica hasta que lo revises y guardes.'}
          </p>
          <Button onClick={handleExtract} disabled={aiLoading || !aiInput.trim()} className="gap-2">
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {aiLoading ? 'Analizando…' : 'Extraer ficha'}
          </Button>
        </div>
      </section>

      {/* Formulario (manual o revisión de IA) */}
      <form
        ref={formRef}
        onSubmit={handleCreateRace}
        className={`bg-[#111827] border rounded-2xl p-6 space-y-4 scroll-mt-6 ${
          form.source === 'ai' && !form.id ? 'border-orange-500/50' : 'border-white/10'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            {form.id ? 'Editar carrera' : form.source === 'ai' ? 'Revisar ficha generada por IA' : 'Añadir carrera manualmente'}
          </h2>
          {(form.id || form.name) && (
            <Button variant="ghost" size="sm" onClick={() => setForm(EMPTY_FORM)}>
              Limpiar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Nombre de la competición *</Label>
            <Input id="name" required value={form.name} onChange={set('name')} placeholder="Ej. Ultra Pirineu 2026" />
          </div>

          <div>
            <Label htmlFor="discipline">Disciplina</Label>
            <select id="discipline" value={form.discipline} onChange={set('discipline')} className={selectCls}>
              <option value="Trail running">Trail running</option>
              <option value="Asfalto">Asfalto</option>
              <option value="Media maratón">Media maratón</option>
              <option value="OCR / Obstáculos">OCR / Obstáculos</option>
            </select>
          </div>

          <div>
            <Label htmlFor="date">Fecha (primer día) *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input id="date" type="date" required value={form.date} onChange={set('date')} />
              <Input
                id="endDate"
                type="date"
                min={form.date || undefined}
                value={form.endDate || ''}
                onChange={set('endDate')}
                aria-label="Último día (si dura varios días)"
                title="Último día (si dura varios días)"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Segunda fecha solo si dura varios días (fin de semana, etapas…).</p>
          </div>

          <div>
            <Label htmlFor="location">Ubicación</Label>
            <Input id="location" value={form.location} onChange={set('location')} placeholder="Ej. Bagà, Berguedà" />
          </div>

          <div>
            <Label htmlFor="distanceText">Distancias</Label>
            <Input id="distanceText" value={form.distanceText} onChange={set('distanceText')} placeholder="Ej. 10 km / 21 km" />
          </div>

          <div>
            <Label htmlFor="price">Precio (€)</Label>
            <Input id="price" type="number" min="0" step="0.5" value={form.price} onChange={set('price')} placeholder="Ej. 45" />
          </div>

          <div>
            <Label htmlFor="link">URL de Inscripción</Label>
            <Input id="link" value={form.link} onChange={set('link')} placeholder="https://..." />
          </div>

          <div>
            <Label htmlFor="image">URL de imagen</Label>
            <Input id="image" value={form.image} onChange={set('image')} placeholder="https://..." />
          </div>

          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <div>
              <Label htmlFor="lat">Latitud</Label>
              <Input id="lat" type="number" step="any" value={form.lat} onChange={set('lat')} placeholder="Auto" />
            </div>
            <div>
              <Label htmlFor="lon">Longitud</Label>
              <Input id="lon" type="number" step="any" value={form.lon} onChange={set('lon')} placeholder="Auto" />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button type="submit" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>{form.id ? 'Guardar cambios' : 'Guardar y publicar'}</span>
          </Button>
        </div>
      </form>

      {/* Lista de carreras */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="text-lg font-semibold text-white">Carreras en catálogo ({races.length})</h2>
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={handleBulkCheck} disabled={!!bulk || !!checkingId}>
            {bulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            {bulk ? `Revisando webs ${bulk.done}/${bulk.total}…` : 'Revisar webs con IA (10)'}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {Object.entries(counts)
            .map(([k, v]) => `${v} ${k}`)
            .join(' · ')}
        </p>
        <div className="space-y-3">
          {races.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-4 bg-[#111827] border border-white/10 rounded-xl">
              <button className="flex items-center gap-4 min-w-0 text-left cursor-pointer" onClick={() => handleEdit(r)} title="Editar">
                <img
                  src={r.image || FALLBACK_IMAGE}
                  alt=""
                  className="w-16 h-12 rounded-lg object-cover bg-gray-900 border border-white/5 shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">{r.name}</h3>
                  <div className="flex flex-wrap gap-x-2 text-xs text-gray-400 mt-1">
                    <span>{r.date}</span>
                    <span>•</span>
                    <span>{r.discipline}</span>
                    {r.price != null && r.price !== '' && (
                      <>
                        <span>•</span>
                        <span className="text-orange-400 font-medium">{r.price}€</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{r.location}</span>
                    {r.lat == null && <span className="text-yellow-500/80">• sin coordenadas</span>}
                  </div>
                  <div className="text-[11px] mt-0.5 truncate">
                    {r.link && r.link !== '#' ? (
                      <span className={r.webVerified ? 'text-emerald-400' : 'text-gray-500'}>
                        {hostOf(r.link)}
                        {r.webVerified ? ' · verificada con IA' : r.webCheckedAt ? ' · revisada' : ''}
                      </span>
                    ) : (
                      <span className="text-yellow-500/80">sin web oficial</span>
                    )}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-gray-500 mr-2">{r.source || 'otros'}</span>
                <button
                  onClick={() => checkWeb(r).catch(() => {})}
                  disabled={!!checkingId || !!bulk}
                  className="p-2 text-gray-400 hover:text-orange-400 disabled:opacity-40 cursor-pointer"
                  title="Buscar la web oficial actual con IA"
                >
                  {checkingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                </button>
                {r.link && r.link !== '#' && (
                  <a href={r.link} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-white">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button onClick={() => deleteRace(r.id)} className="p-2 text-red-400 hover:text-red-300 cursor-pointer" title="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
