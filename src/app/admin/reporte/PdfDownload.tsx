'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';

import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { getStoreDayKey } from '@/lib/format';

interface Preset {
  label: string;
  range: () => { from: string; to: string };
}

const day = (offset: number) => getStoreDayKey(offset);

const PRESETS: Preset[] = [
  { label: 'Hoy', range: () => ({ from: day(0), to: day(0) }) },
  { label: 'Ayer', range: () => ({ from: day(-1), to: day(-1) }) },
  { label: 'Manana', range: () => ({ from: day(1), to: day(1) }) },
  { label: 'Ultimos 7 dias', range: () => ({ from: day(-6), to: day(0) }) },
  { label: 'Este mes', range: () => ({ from: `${day(0).slice(0, 8)}01`, to: day(0) }) },
  { label: 'Todo', range: () => ({ from: '', to: '' }) },
];

const CHIP_CLASS = 'rounded-full border px-3 py-1 text-xs font-medium transition';

/** Descarga el PDF del reporte; las fechas (opcionales) acotan los pedidos incluidos. */
export function PdfDownload({ owner }: { owner?: string }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = new URLSearchParams();
  if (owner) query.set('duenio', owner);
  if (from) query.set('desde', from);
  if (to) query.set('hasta', to);

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Periodos rapidos">
        {PRESETS.map((preset) => {
          const range = preset.range();
          const isActive = range.from === from && range.to === to;

          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setFrom(range.from);
                setTo(range.to);
              }}
              className={`${CHIP_CLASS} ${
                isActive
                  ? 'border-pink-400 bg-pink-50 text-pink-700'
                  : 'border-brand-200 bg-white text-slate-700 hover:border-pink-300 hover:bg-pink-50'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className={LABEL_CLASS} htmlFor="report-from">
          Desde
        </label>
        <input
          id="report-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => setFrom(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="report-to">
          Hasta
        </label>
        <input
          id="report-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => setTo(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <a href={`/admin/reporte/pdf?${query.toString()}`} download className={PRIMARY_BUTTON_CLASS}>
        <Download className="h-4 w-4" />
        Descargar PDF
      </a>
      </div>
    </div>
  );
}
