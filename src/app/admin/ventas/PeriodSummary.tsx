import Link from 'next/link';

import { formatCurrency, getStoreDayKey } from '@/lib/format';

export const SUMMARY_PERIODS = {
  hoy: { label: 'Hoy', from: () => getStoreDayKey(0) },
  semana: { label: 'Semana', from: () => getStoreDayKey(-6) },
  mes: { label: 'Mes', from: () => `${getStoreDayKey(0).slice(0, 8)}01` },
} as const;

export type SummaryPeriod = keyof typeof SUMMARY_PERIODS;

export const DEFAULT_SUMMARY_PERIOD: SummaryPeriod = 'hoy';

export function readSummaryPeriod(value: string | undefined): SummaryPeriod {
  return value && value in SUMMARY_PERIODS ? (value as SummaryPeriod) : DEFAULT_SUMMARY_PERIOD;
}

const PERIOD_HINTS: Record<SummaryPeriod, string> = {
  hoy: 'Ventas de hoy',
  semana: 'Ventas de los ultimos 7 dias',
  mes: 'Ventas de este mes',
};

/** Efectivo recibido y deliverys acumulados del periodo elegido (por fecha de la venta, sin canceladas). */
export function PeriodSummary({
  period,
  cashReceived,
  shippingTotal,
  shippingCount,
}: {
  period: SummaryPeriod;
  cashReceived: number;
  shippingTotal: number;
  shippingCount: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{PERIOD_HINTS[period]}</p>
        <nav
          aria-label="Periodo del resumen"
          className="inline-flex rounded-lg border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {(Object.keys(SUMMARY_PERIODS) as SummaryPeriod[]).map((key) => (
            <Link
              key={key}
              href={`?periodo=${key}`}
              scroll={false}
              aria-current={key === period ? 'page' : undefined}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                key === period
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {SUMMARY_PERIODS[key].label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Efectivo recibido</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-emerald-900 dark:text-emerald-200">
            {formatCurrency(cashReceived)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/40">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-300">Deliverys acumulados</p>
            <p className="text-xs tabular-nums text-sky-700/80 dark:text-sky-400/80">
              {shippingCount} {shippingCount === 1 ? 'envio' : 'envios'}
            </p>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-sky-900 dark:text-sky-200">
            {formatCurrency(shippingTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
