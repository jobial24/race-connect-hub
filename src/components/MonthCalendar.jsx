import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { todayLocal } from '@/lib/raceDedupe';
import { colorsFor } from '@/components/RaceDetailSheet';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Calendario mensual. items: [{ key, date, endDate?, name, discipline, mine }]
 * Mis carreras = chip relleno · otras carreras del catálogo = chip con borde.
 */
export default function MonthCalendar({ month, onMonthChange, items, selected, onSelectDay, onSelectItem }) {
  const today = todayLocal();
  const { y, m } = month;

  const byDay = useMemo(() => {
    const map = {};
    for (const it of items) {
      if (!it.date) continue;
      // eventos de varios días (fin de semana Spartan): se pintan cada día
      const start = new Date(`${it.date}T12:00:00`);
      const end = new Date(`${it.endDate || it.date}T12:00:00`);
      for (let d = new Date(start); d <= end && (d - start) / 864e5 < 7; d.setDate(d.getDate() + 1)) {
        const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
        (map[k] ||= []).push(it);
      }
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => Number(b.mine) - Number(a.mine));
    return map;
  }, [items]);

  const cells = useMemo(() => {
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7; // lunes primero
    const days = new Date(y, m + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(iso(y, m, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [y, m]);

  const t = new Date(y, m, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const title = t.charAt(0).toUpperCase() + t.slice(1);
  const go = (delta) => {
    const d = new Date(y, m + delta, 1);
    onMonthChange({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    const d = new Date();
    onMonthChange({ y: d.getFullYear(), m: d.getMonth() });
    onSelectDay(today);
  };

  return (
    <div className="bg-[#111827] border border-white/10 rounded-2xl p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => go(-1)} className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer" aria-label="Mes anterior">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={goToday} className="text-[11px] px-2 py-0.5 rounded-full border border-white/15 text-gray-300 hover:text-white cursor-pointer">
            Hoy
          </button>
        </div>
        <button onClick={() => go(1)} className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer" aria-label="Mes siguiente">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-500 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const list = byDay[day] || [];
          const isToday = day === today;
          const isSel = day === selected;
          const past = day < today;
          return (
            <button
              key={day}
              onClick={() => onSelectDay(day)}
              className={`relative min-h-14 sm:min-h-24 rounded-lg border p-1 text-left flex flex-col gap-0.5 transition-colors cursor-pointer ${
                isSel ? 'border-orange-500 bg-orange-500/10' : 'border-white/5 hover:border-white/20'
              } ${past ? 'opacity-50' : ''}`}
            >
              <span
                className={`text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                  isToday ? 'bg-orange-500 text-white' : 'text-gray-300'
                }`}
              >
                {Number(day.slice(8))}
              </span>

              {/* Móvil: puntos de color */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {list.slice(0, 4).map((it) => (
                  <span
                    key={it.key}
                    className={`w-1.5 h-1.5 rounded-full ${it.mine ? colorsFor(it.discipline).dot : 'border border-gray-400'}`}
                  />
                ))}
              </span>

              {/* Escritorio: nombres */}
              <span className="hidden sm:flex flex-col gap-0.5 min-w-0">
                {list.slice(0, 3).map((it) => (
                  <span
                    key={it.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectItem(it);
                    }}
                    className={`truncate text-[10px] leading-tight px-1 py-0.5 rounded border ${
                      it.mine ? colorsFor(it.discipline).chip + ' font-semibold' : 'border-white/10 text-gray-400'
                    }`}
                    title={it.name}
                  >
                    {it.mine ? '★ ' : ''}
                    {it.name}
                  </span>
                ))}
                {list.length > 3 && <span className="text-[10px] text-gray-500 px-1">+{list.length - 3} más</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400" /> Ciudad
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Trail
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-violet-400" /> Obstáculos
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full border border-gray-400" /> Otras carreras (no inscrito)
        </span>
      </div>
    </div>
  );
}
