import { formatCurrency, formatScheduleDay } from '@/lib/format';
import { type PeriodSummaryData, SUMMARY_PERIODS, type SummaryPeriod } from '@/lib/period-summary';

const formatDay = (day: string) => formatScheduleDay(new Date(`${day}T00:00:00Z`));

/** Efectivo recibido y deliverys acumulados del periodo, calculados con las ventas visibles en la tabla. */
export function PeriodSummary({
  period,
  onPeriodChange,
  summary,
  isFiltered,
}: {
  period: SummaryPeriod;
  onPeriodChange: (period: SummaryPeriod) => void;
  summary: PeriodSummaryData;
  /** La tabla tiene busqueda o filtros activos: el resumen solo suma esas ventas. */
  isFiltered: boolean;
}) {
  const { range, cashReceived, shippingTotal, shippingCount, withoutKmCount } = summary;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {range.from === range.to ? `Hoy ${formatDay(range.to)}` : `Del ${formatDay(range.from)} al ${formatDay(range.to)}`}
          {isFiltered && ' · solo las ventas filtradas'}
        </p>
        <div
          role="group"
          aria-label="Periodo del resumen"
          className="inline-flex rounded-lg border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {(Object.keys(SUMMARY_PERIODS) as SummaryPeriod[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === period}
              onClick={() => onPeriodChange(key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                key === period
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {SUMMARY_PERIODS[key].label}
            </button>
          ))}
        </div>
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
              {withoutKmCount > 0 && (
                <span className="text-amber-700 dark:text-amber-400"> · {withoutKmCount} sin km (no suman)</span>
              )}
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
