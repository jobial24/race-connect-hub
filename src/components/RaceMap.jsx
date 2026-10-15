// Mapa de carreras con Leaflet + teselas de OpenStreetMap (estilo oscuro de CARTO).
// Leaflet va incluido en public/vendor/leaflet y se carga solo la primera vez que
// se abre el mapa (no hace falta instalar nada con npm y funciona en la app móvil).
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ScanSearch, LocateFixed } from 'lucide-react';
import { categoryOf } from '@/lib/raceCategories';
import { formatRange } from '@/lib/dates';

const LEAFLET_BASE = `${import.meta.env.BASE_URL || '/'}vendor/leaflet`;
const COLORS = { city: '#f97316', trail: '#22c55e', ocr: '#a855f7' };
export const MAP_LEGEND = [
  ['city', 'Ciudad'],
  ['trail', 'Trail'],
  ['ocr', 'Obstáculos'],
];

let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${LEAFLET_BASE}/leaflet.css`;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = `${LEAFLET_BASE}/leaflet.js`;
    js.async = true;
    js.onload = () => resolve(window.L);
    js.onerror = () => {
      leafletPromise = null;
      reject(new Error('No se pudo cargar el mapa.'));
    };
    document.head.appendChild(js);
  });
  return leafletPromise;
}

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Agrupa carreras con las mismas coordenadas (mismo municipio) en un solo marcador. */
function groupByPoint(races) {
  const groups = new Map();
  for (const r of races) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) continue;
    const key = `${r.lat.toFixed(3)},${r.lon.toFixed(3)}`;
    const g = groups.get(key) || { lat: r.lat, lon: r.lon, races: [] };
    g.races.push(r);
    groups.set(key, g);
  }
  return [...groups.values()];
}

function popupHtml(group) {
  const items = group.races
    .slice(0, 8)
    .map((r) => {
      const cat = categoryOf(r);
      return `<button class="rc-pop-item" data-race="${esc(r.id)}">
        <span class="rc-dot" style="background:${COLORS[cat]}"></span>
        <span class="rc-pop-text"><strong>${esc(r.name)}</strong><small>${esc(formatRange(r))}${r.distanceText ? ` · ${esc(r.distanceText)}` : ''}</small></span>
      </button>`;
    })
    .join('');
  const more = group.races.length > 8 ? `<p class="rc-pop-more">y ${group.races.length - 8} más…</p>` : '';
  return `<div class="rc-pop"><p class="rc-pop-title">${esc(group.races[0].location || '')}</p>${items}${more}</div>`;
}

/**
 * @param races carreras ya filtradas (salvo el filtro de "zona del mapa")
 * @param center {lat, lon, radius?} círculo de cercanía a dibujar (opcional)
 * @param origin punto de partida del usuario
 * @param boundsActive si el filtro "zona del mapa" está activo, no se recoloca el mapa
 * @param onSearchArea(bounds) "Buscar en esta zona"
 * @param onSelect(raceId) al pulsar una carrera del globo
 */
export default function RaceMap({ races, center, origin, boundsActive, onSearchArea, onSelect }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [state, setState] = useState({ loading: true, error: '' });
  const [moved, setMoved] = useState(false);
  const programmatic = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Crear el mapa una vez
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !el.current || map.current) return;
        const m = L.map(el.current, { zoomControl: true, attributionControl: true, worldCopyJump: true }).setView([41.6, 2.0], 8);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 18,
          subdomains: 'abcd',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        }).addTo(m);
        layer.current = L.layerGroup().addTo(m);
        m.on('moveend', () => {
          if (programmatic.current) programmatic.current = false;
          else setMoved(true);
        });
        // clic en una carrera dentro del globo
        el.current.addEventListener('click', (e) => {
          const btn = e.target.closest?.('[data-race]');
          if (btn) onSelectRef.current?.(btn.getAttribute('data-race'));
        });
        map.current = m;
        setState({ loading: false, error: '' });
      })
      .catch((e) => !cancelled && setState({ loading: false, error: e.message }));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Pintar marcadores cada vez que cambian las carreras
  useEffect(() => {
    const L = window.L;
    const m = map.current;
    if (!L || !m || state.loading) return;
    layer.current.clearLayers();
    const groups = groupByPoint(races);
    const pts = [];
    for (const g of groups) {
      const cats = new Set(g.races.map(categoryOf));
      const color = cats.size === 1 ? COLORS[[...cats][0]] : '#38bdf8';
      const n = g.races.length;
      const icon = L.divIcon({
        className: '',
        html: `<div class="rc-marker" style="--c:${color}">${n > 1 ? n : ''}</div>`,
        iconSize: n > 1 ? [28, 28] : [16, 16],
        iconAnchor: n > 1 ? [14, 14] : [8, 8],
      });
      L.marker([g.lat, g.lon], { icon, riseOnHover: true })
        .bindPopup(popupHtml(g), { maxWidth: 280, className: 'rc-popup' })
        .addTo(layer.current);
      pts.push([g.lat, g.lon]);
    }
    if (origin && Number.isFinite(origin.lat)) {
      L.circleMarker([origin.lat, origin.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 })
        .bindTooltip(origin.mode === 'gps' ? 'Tú' : origin.name)
        .addTo(layer.current);
    }
    let circle = null;
    if (center?.radius) {
      circle = L.circle([center.lat, center.lon], {
        radius: center.radius * 1000,
        color: '#f97316',
        weight: 1,
        fillOpacity: 0.05,
        dashArray: '4 4',
      }).addTo(layer.current);
    }
    // Recolocar la vista (salvo si el usuario está filtrando por la zona del mapa)
    if (!boundsActive) {
      programmatic.current = true;
      if (circle) m.fitBounds(circle.getBounds(), { padding: [20, 20] });
      else if (pts.length) m.fitBounds(L.latLngBounds(pts).pad(0.1), { maxZoom: 11 });
      else programmatic.current = false;
      setTimeout(() => (programmatic.current = false), 700);
      setMoved(false);
    }
  }, [races, center?.lat, center?.lon, center?.radius, origin?.lat, origin?.lon, boundsActive, state.loading]);

  // El contenedor cambia de tamaño (p. ej. al girar el móvil)
  useEffect(() => {
    if (!map.current || !el.current || !window.ResizeObserver) return;
    const ro = new ResizeObserver(() => map.current?.invalidateSize());
    ro.observe(el.current);
    return () => ro.disconnect();
  }, [state.loading]);

  const searchArea = () => {
    const b = map.current.getBounds();
    onSearchArea([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
    setMoved(false);
  };

  const recenter = () => {
    if (!origin) return;
    programmatic.current = true;
    map.current?.setView([origin.lat, origin.lon], 10);
    setTimeout(() => (programmatic.current = false), 700);
  };

  const withoutCoords = races.filter((r) => !Number.isFinite(r.lat)).length;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#111827]">
      <div ref={el} className="h-[58vh] min-h-[340px] w-full z-0" />
      {state.loading && (
        <div className="absolute inset-0 grid place-items-center text-sm text-gray-400">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando mapa…
          </span>
        </div>
      )}
      {state.error && <div className="absolute inset-0 grid place-items-center text-sm text-red-400 p-6 text-center">{state.error}</div>}

      {!state.loading && !state.error && (
        <>
          {moved && (
            <button
              onClick={searchArea}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] h-9 px-4 rounded-full bg-orange-500 text-white text-xs font-bold shadow-lg shadow-black/40 inline-flex items-center gap-1.5 cursor-pointer hover:bg-orange-600"
            >
              <ScanSearch className="w-4 h-4" /> Buscar en esta zona
            </button>
          )}
          <button
            onClick={recenter}
            title="Centrar en mi punto de partida"
            className="absolute bottom-8 right-3 z-[500] w-9 h-9 rounded-full bg-[#111827] border border-white/20 text-gray-200 grid place-items-center cursor-pointer hover:text-white"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
          <div className="absolute bottom-6 left-3 z-[500] flex gap-2 rounded-full bg-[#0B0F19]/85 border border-white/10 px-3 py-1.5 text-[11px] text-gray-300">
            {MAP_LEGEND.map(([id, label]) => (
              <span key={id} className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[id] }} />
                {label}
              </span>
            ))}
          </div>
          {withoutCoords > 0 && (
            <div className="absolute top-3 right-3 z-[500] rounded-full bg-[#0B0F19]/85 border border-white/10 px-3 py-1 text-[10px] text-gray-400">
              {withoutCoords} sin ubicar en el mapa
            </div>
          )}
        </>
      )}
    </div>
  );
}
