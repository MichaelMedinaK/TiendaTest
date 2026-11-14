'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';

import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';

/** Descarga el PDF del reporte; las fechas (opcionales) acotan los pedidos incluidos. */
export function PdfDownload({ owner }: { owner?: string }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = new URLSearchParams();
  if (owner) query.set('duenio', owner);
  if (from) query.set('desde', from);
  if (to) query.set('hasta', to);

  return (
    <div className="flex flex-wrap items-end gap-2 print:hidden">
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
  );
}
