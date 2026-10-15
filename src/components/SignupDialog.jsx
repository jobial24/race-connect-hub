import React, { useState, useEffect } from 'react';
import { X, Save, CalendarDays, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildSignup, saveSignup } from '@/services/myRaces';
import { parseDistancesKm } from '@/lib/raceCategories';
import { cloudEnabled } from '@/lib/supabase';
import { formatRange, eventDayList, shortDay } from '@/lib/dates';

/** Opciones de distancia: inscripciones de xipgroc o distancias deducidas del texto. */
export function distanceOptions(race) {
  if (!race) return [];
  if (race.inscriptions?.length) return [...new Set(race.inscriptions.map((i) => i.label))];
  return parseDistancesKm(race).map((d) => (d === 21.1 ? 'Media maratón' : d === 42.2 ? 'Maratón' : `${d} km`));
}

/**
 * Formulario de inscripción precargado con los datos de la carrera.
 * props: race (catálogo, opcional), initial (datos ya conocidos), onClose, onSaved
 */
export default function SignupDialog({ race, initial = {}, onClose, onSaved }) {
  const [form, setForm] = useState(() => buildSignup(race, initial));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const options = distanceOptions(race);

  const submit = (e) => {
    e.preventDefault();
    const saved = saveSignup({
      ...form,
      price: form.price === '' || form.price == null ? null : Number(form.price),
    });
    onSaved?.(saved);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#111827] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-orange-400 font-semibold">Mi inscripción</p>
            {race ? (
              <>
                <h2 className="text-lg font-bold text-white leading-tight">{form.name}</h2>
                <p className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-3">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> {formatRange(form)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {form.location}
                  </span>
                </p>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="col-span-2">
                  <Label htmlFor="s-name">Carrera *</Label>
                  <Input id="s-name" required value={form.name} onChange={set('name')} />
                </div>
                <div>
                  <Label htmlFor="s-date">Fecha *</Label>
                  <Input id="s-date" type="date" required value={form.date} onChange={set('date')} />
                </div>
                <div>
                  <Label htmlFor="s-loc">Lugar</Label>
                  <Input id="s-loc" value={form.location} onChange={set('location')} />
                </div>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-white cursor-pointer" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {form.eventEndDate && (
          <div>
            <Label>¿Qué día corres?</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setForm({ ...form, date: form.eventDate, endDate: form.eventEndDate })}
                className={`h-8 px-3 rounded-full text-xs border cursor-pointer ${
                  form.endDate ? 'bg-orange-500 border-orange-500 text-white' : 'border-white/15 text-gray-200 hover:border-white/40'
                }`}
              >
                Todo el evento
              </button>
              {eventDayList({ date: form.eventDate, endDate: form.eventEndDate }).map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setForm({ ...form, date: d, endDate: '' })}
                  className={`h-8 px-3 rounded-full text-xs border cursor-pointer ${
                    !form.endDate && form.date === d ? 'bg-orange-500 border-orange-500 text-white' : 'border-white/15 text-gray-200 hover:border-white/40'
                  }`}
                >
                  {shortDay(d)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label>Distancia</Label>
          {options.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {options.map((o) => (
                <button
                  type="button"
                  key={o}
                  onClick={() => setForm({ ...form, distance: o })}
                  className={`h-8 px-3 rounded-full text-xs border cursor-pointer ${
                    form.distance === o ? 'bg-orange-500 border-orange-500 text-white' : 'border-white/15 text-gray-200 hover:border-white/40'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
          <Input value={form.distance} onChange={set('distance')} placeholder="Ej. 10K" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="s-bib">Dorsal</Label>
            <Input id="s-bib" value={form.bib} onChange={set('bib')} placeholder="Se asigna después" />
          </div>
          <div>
            <Label htmlFor="s-price">Precio pagado (€)</Label>
            <Input id="s-price" type="number" step="0.5" min="0" value={form.price ?? ''} onChange={set('price')} />
          </div>
          <div>
            <Label htmlFor="s-time">Hora de salida</Label>
            <Input id="s-time" type="time" value={form.startTime} onChange={set('startTime')} />
          </div>
          <div>
            <Label htmlFor="s-goal">Objetivo</Label>
            <Input id="s-goal" value={form.goalTime} onChange={set('goalTime')} placeholder="Ej. 49:59" />
          </div>
          {form.date && form.date < new Date().toISOString().slice(0, 10) && (
            <div className="col-span-2">
              <Label htmlFor="s-finish">Mi tiempo final</Label>
              <Input id="s-finish" value={form.finishTime || ''} onChange={set('finishTime')} placeholder="hh:mm:ss" />
            </div>
          )}
          <div className="col-span-2">
            <Label htmlFor="s-code">Código / localizador</Label>
            <Input id="s-code" value={form.confirmationCode} onChange={set('confirmationCode')} placeholder="Del email de confirmación" />
          </div>
          <div className="col-span-2">
            <Label htmlFor="s-pickup">Recogida de dorsal</Label>
            <Input id="s-pickup" value={form.pickup} onChange={set('pickup')} placeholder="Lugar y horario" />
          </div>
        </div>

        {cloudEnabled && (
          <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isPublic !== false}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              className="w-4 h-4 accent-orange-500"
            />
            Mostrar a otros corredores que voy («¿Quién va?»)
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="gap-2">
            <Save className="w-4 h-4" /> Guardar inscripción
          </Button>
        </div>
      </form>
    </div>
  );
}
