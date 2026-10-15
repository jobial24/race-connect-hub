// Barra de búsqueda inteligente: escribe en lenguaje normal y se convierte en chips.
import React, { useMemo, useRef, useState } from 'react';
import { Search, X, MapPin, Sparkles, CornerDownLeft, Calendar, Ruler, LocateFixed, Building2, Mountain, Dumbbell, LayoutGrid, Type, Map as MapIcon } from 'lucide-react';
import { normalizePlace } from '@/lib/places';
import { parseQuery, mergeParsed, placeLabel, CATEGORY_LABELS, RADIUS_STEPS } from '@/lib/smartSearch';

export const CATEGORY_TABS = [
  ['all', 'Todas', LayoutGrid],
  ['city', 'Ciudad', Building2],
  ['trail', 'Trail', Mountain],
  ['ocr', 'Obstáculos', Dumbbell],
];

const EXAMPLES = ['trail cerca de Terrassa en noviembre', '10K este finde', 'obstáculos Cataluña', 'media maratón marzo', 'ultra Girona provincia'];

function Chip({ icon: Icon, children, onRemove, tone = 'orange' }) {
  const tones = {
    orange: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
    sky: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    gray: 'border-white/15 bg-white/5 text-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 h-8 pl-3 pr-1 rounded-full border text-xs font-semibold whitespace-nowrap ${tones[tone]}`}>
      {Icon && <Icon className="w-3.5 h-3.5 opacity-80" />}
      {children}
      <button onClick={onRemove} aria-label="Quitar filtro" className="w-6 h-6 grid place-items-center rounded-full hover:bg-white/10 cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

/** Vista previa de lo que se ha entendido */
function describe(parsed, origin) {
  const parts = [];
  if (parsed.category) parts.push(CATEGORY_LABELS[parsed.category]);
  if (parsed.dist) parts.push(parsed.dist.label);
  if (parsed.when) parts.push(parsed.when.label);
  if (parsed.place) parts.push(placeLabel(parsed.place, origin));
  else if (parsed.nearMe || parsed.radius) parts.push(`Cerca de ti${parsed.radius ? ` · ${parsed.radius} km` : ''}`);
  if (parsed.text) parts.push(`«${parsed.text}»`);
  return parts;
}

export default function SmartSearchBar({ filters, setFilters, placeIndex, origin, onNearMe, races, tabCounts, shortcuts }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef(null);

  const parsed = useMemo(() => (q.trim() ? parseQuery(q, placeIndex) : null), [q, placeIndex]);

  // Sugerencias: 1) aplicar lo entendido  2) lugares  3) carreras por nombre
  const suggestions = useMemo(() => {
    const out = [];
    const nq = normalizePlace(q.trim());
    if (!nq) return EXAMPLES.map((e) => ({ kind: 'example', label: e }));
    if (parsed) out.push({ kind: 'apply', parts: describe(parsed, origin) });
    // lugar: lo último que se está escribiendo (1–3 palabras)
    const words = nq.split(/\s+/);
    const seen = new Set();
    for (let n = Math.min(3, words.length); n >= 1 && out.length < 6; n--) {
      const frag = words.slice(-n).join(' ');
      if (frag.length < 2) continue;
      for (const [key, place] of placeIndex) {
        if (out.length >= 6) break;
        if (!key.startsWith(frag) || seen.has(place.label) || key.startsWith('provincia ')) continue;
        seen.add(place.label);
        out.push({ kind: 'place', place, frag: words.slice(0, -n).join(' ') });
      }
    }
    if (nq.length >= 3) {
      const hits = races.filter((r) => normalizePlace(r.name).includes(nq)).slice(0, 4);
      for (const r of hits) out.push({ kind: 'race', race: r });
    }
    return out;
  }, [q, parsed, placeIndex, races, origin]);

  const apply = (text = q) => {
    if (!text.trim()) return;
    const p = parseQuery(text, placeIndex);
    if (p.nearMe && !p.place) onNearMe?.();
    setFilters((f) => mergeParsed(f, p, origin));
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const choose = (s) => {
    if (!s) return apply();
    if (s.kind === 'example') return apply(s.label);
    if (s.kind === 'apply') return apply();
    if (s.kind === 'place') {
      const p = s.frag ? parseQuery(s.frag, placeIndex) : { text: '' };
      setFilters((f) => ({ ...mergeParsed(f, p, origin), place: s.place }));
      setQ('');
      setOpen(false);
      return;
    }
    if (s.kind === 'race') {
      setFilters((f) => ({ ...f, text: normalizePlace(s.race.name), place: null, when: null, dist: null, category: 'all' }));
      setQ('');
      setOpen(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(open && q.trim() ? suggestions[hi] : null);
    } else if (e.key === 'Escape') setOpen(false);
  };

  const f = filters;
  const hasChips = f.dist || f.when || f.place || f.text;
  const setRadius = (r) => setFilters((x) => ({ ...x, place: { ...x.place, radius: r } }));

  return (
    <div className="bg-[#111827] border border-white/10 rounded-2xl p-3 sm:p-4 space-y-3">
      {/* Barra */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400 pointer-events-none" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
          enterKeyHint="search"
          placeholder="¿Qué buscas? Ej.: trail cerca de Terrassa en noviembre"
          className="w-full h-12 sm:h-13 rounded-xl bg-[#0B0F19] border border-white/10 pl-12 pr-11 text-sm sm:text-base text-white placeholder:text-gray-500 focus:border-orange-500 focus:outline-none"
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Borrar" className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full text-gray-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}

        {open && suggestions.length > 0 && (
          <div className="absolute z-[1000] left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#0F1522] shadow-2xl shadow-black/60 overflow-hidden">
            {!q.trim() && <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-gray-500">Prueba con…</p>}
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                onMouseEnter={() => setHi(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm cursor-pointer ${hi === i && q.trim() ? 'bg-white/5' : ''}`}
              >
                {s.kind === 'example' && (
                  <>
                    <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
                    <span className="text-gray-300">{s.label}</span>
                  </>
                )}
                {s.kind === 'apply' && (
                  <>
                    <CornerDownLeft className="w-4 h-4 text-orange-400 shrink-0" />
                    <span className="flex flex-wrap gap-1">
                      {s.parts.map((p) => (
                        <span key={p} className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-200 text-xs font-semibold">
                          {p}
                        </span>
                      ))}
                    </span>
                  </>
                )}
                {s.kind === 'place' && (
                  <>
                    <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="text-white">{s.place.label.replace(' (provincia)', '')}</span>
                    <span className="text-[11px] text-gray-500">
                      {s.place.type}
                      {s.place.count ? ` · ${s.place.count} carreras` : ''}
                    </span>
                  </>
                )}
                {s.kind === 'race' && (
                  <>
                    <Search className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="text-gray-200 truncate">{s.race.name}</span>
                    <span className="text-[11px] text-gray-500 shrink-0">{s.race.date}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pestañas de tipo */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#0B0F19] border border-white/10" role="tablist">
        {CATEGORY_TABS.map(([id, label, Icon]) => {
          const active = f.category === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => setFilters((x) => ({ ...x, category: id, dist: null }))}
              className={`h-11 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 text-[11px] sm:text-sm font-semibold cursor-pointer transition-colors ${
                active ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>
                {label} <span className={`font-normal ${active ? 'text-white/75' : 'text-gray-500'}`}>{tabCounts[id] ?? 0}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros activos */}
      {hasChips && (
        <div className="flex flex-wrap items-center gap-1.5">
          {f.place && (
            <Chip icon={f.place.kind === 'bounds' ? MapIcon : MapPin} tone="sky" onRemove={() => setFilters((x) => ({ ...x, place: null }))}>
              {f.place.kind === 'near' ? (
                <>
                  {placeLabel(f.place, origin, { radius: false })}
                  <select
                    aria-label="Radio"
                    value={f.place.radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="bg-sky-500/15 rounded-md px-1 text-sky-100 font-semibold focus:outline-none cursor-pointer"
                  >
                    {[...new Set([...RADIUS_STEPS, f.place.radius])].sort((a, b) => a - b).map((r) => (
                      <option key={r} value={r} className="bg-[#111827]">
                        {r} km
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                placeLabel(f.place, origin)
              )}
            </Chip>
          )}
          {f.when && (
            <Chip icon={Calendar} onRemove={() => setFilters((x) => ({ ...x, when: null }))}>
              {f.when.label}
            </Chip>
          )}
          {f.dist && (
            <Chip icon={Ruler} onRemove={() => setFilters((x) => ({ ...x, dist: null }))}>
              {f.dist.label}
            </Chip>
          )}
          {f.text && (
            <Chip icon={Type} tone="gray" onRemove={() => setFilters((x) => ({ ...x, text: '' }))}>
              «{f.text}»
            </Chip>
          )}
          <button
            onClick={() => setFilters((x) => ({ ...x, dist: null, when: null, place: null, text: '', category: 'all' }))}
            className="h-8 px-2 text-[11px] text-gray-400 hover:text-white cursor-pointer"
          >
            Borrar todo
          </button>
        </div>
      )}

      {/* Atajos */}
      <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 [scrollbar-width:none]">
        {!(f.place?.kind === 'near' && f.place.origin) && (
          <button
            onClick={() => {
              onNearMe?.();
              setFilters((x) => ({ ...x, place: { kind: 'near', origin: true, radius: 30 } }));
            }}
            className="h-8 px-3 rounded-full border border-sky-500/30 text-sky-300 text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 hover:bg-sky-500/10 cursor-pointer"
          >
            <LocateFixed className="w-3.5 h-3.5" /> Cerca de mí
          </button>
        )}
        {shortcuts.map((s) => (
          <button
            key={s.key}
            onClick={s.onClick}
            disabled={!s.count}
            className={`h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-35 disabled:cursor-default ${
              s.active ? 'border-orange-500/60 bg-orange-500/15 text-orange-200' : 'border-white/10 text-gray-300 hover:border-white/30'
            }`}
          >
            {s.label} <span className="font-normal text-gray-500">{s.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
