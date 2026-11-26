'use client';

import { Download } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { prepareSalesReport } from '@/actions/reports';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, TABLE_CELL_CLASS, TABLE_CLASS, TABLE_HEAD_CELL_CLASS } from '@/components/ui/styles';
import { formatCurrency, getStoreDayKey } from '@/lib/format';

type Prepared = Extract<Awaited<ReturnType<typeof prepareSalesReport>>, { success: true }>['data'];

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

export function PdfDownload({ owner }: { owner?: string }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<Prepared | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function setRange(start: string, end: string) {
    setReport(null);
    setError('');
    setFrom(start);
    setTo(end);
  }

  function prepare() {
    setReport(null);
    setError('');
    startTransition(async () => {
      const result = await prepareSalesReport(owner, { from: from || undefined, to: to || undefined });
      if (result.success) setReport(result.data);
      else setError(result.error);
    });
  }

  return (
    <div className={`${CARD_CLASS} space-y-3 print:hidden`}>
      <h2 className="font-semibold">Informe de ventas y cierre de efectivo</h2>
      <p className="text-sm text-slate-600">Elige el periodo y revisa el stock que deberias tener antes de descargar el PDF.</p>
      <form onSubmit={(event) => { event.preventDefault(); prepare(); }}>
        <fieldset disabled={isPending} className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Periodos rapidos">
            {PRESETS.map((preset) => {
              const range = preset.range();
              const isActive = range.from === from && range.to === to;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setRange(range.from, range.to)}
                  className={`${CHIP_CLASS} ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                      : 'border-zinc-300 bg-white text-slate-700 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className={LABEL_CLASS}>Desde</span>
              <input type="date" value={from} max={to || undefined} className={INPUT_CLASS}
                onChange={(event) => setRange(event.target.value, to)} />
            </label>
            <label>
              <span className={LABEL_CLASS}>Hasta</span>
              <input type="date" value={to} min={from || undefined} className={INPUT_CLASS}
                onChange={(event) => setRange(from, event.target.value)} />
            </label>
            <button type="submit" className={PRIMARY_BUTTON_CLASS}>
              {isPending ? 'Preparando...' : report ? 'Actualizar cierre' : 'Revisar cierre'}
            </button>
          </div>
        </fieldset>
      </form>
      {error && <FeedbackMessage tone="error" message={error} />}
      {report && <ClosingPreview report={report} />}
    </div>
  );
}

function ClosingPreview({ report }: { report: Prepared }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const href = URL.createObjectURL(new Blob([new Uint8Array(report.pdf)], { type: 'application/pdf' }));
    setUrl(href);
    return () => URL.revokeObjectURL(href);
  }, [report]);
  const { cash, deliveryFees, net, undatedFees } = report.settlement;
  return (
    <div className="space-y-3 border-t pt-3">
      <h3 className="font-semibold">Stock esperado al cierre: {report.scope}</h3>
      <p className="text-sm">Inicial + otros movimientos - ventas netas = esperado. La primera carga se incluye en el inicial.
        Las ventas registradas ya descuentan stock, incluso las pendientes de entrega. Un negativo indica unidades por reponer.</p>
      <div className="overflow-x-auto">
        <table className={TABLE_CLASS}>
          <thead><tr>{['Producto / inventario', 'Inicial', 'Otros movimientos', 'Ventas netas', 'Esperado'].map((label) =>
            <th key={label} className={TABLE_HEAD_CELL_CLASS}>{label}</th>)}</tr></thead>
          <tbody>
            {report.stock.map((row, i) => (
              <tr key={i}>
                <td className={TABLE_CELL_CLASS}>{row.label}{row.owner && <small className="block">{row.owner}</small>}</td>
                <td className={TABLE_CELL_CLASS}>{row.initial}</td><td className={TABLE_CELL_CLASS}>{row.other}</td>
                <td className={TABLE_CELL_CLASS}>{row.sold}</td><td className={`${TABLE_CELL_CLASS} font-bold`}>{row.stock}</td>
              </tr>
            ))}
            {!report.stock.length && <tr><td colSpan={5} className={TABLE_CELL_CLASS}>Sin productos al cierre.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-sm">Efectivo recibido: {formatCurrency(cash)}. Deliverys realizados: {formatCurrency(deliveryFees)}.{' '}
        <strong>{net < 0 ? 'Falta para cubrir deliverys' : 'A entregar a la tendera'}: {formatCurrency(Math.abs(net))}.</strong></p>
      {undatedFees > 0 && <p className="text-sm text-amber-700">Rendicion parcial: no se descontaron {formatCurrency(undatedFees)} de envios antiguos sin fecha de entrega. Usa Todo para incluirlos.</p>}
      <p className="text-sm text-slate-600">Compara el stock esperado con lo que tienes. Descargar el informe no modifica el inventario ni borra ventas.</p>
      {url && <a href={url} download={report.filename} className={PRIMARY_BUTTON_CLASS}><Download className="h-4 w-4" />Descargar PDF</a>}
    </div>
  );
}
