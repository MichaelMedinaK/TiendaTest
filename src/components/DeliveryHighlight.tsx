import { Banknote, CalendarClock, MapPin } from 'lucide-react';

interface DeliveryHighlightProps {
  address: string | null;
  schedule: string | null;
  /** Texto del monto a cobrar en la entrega (tramites). */
  amount?: string | null;
}

/** Direccion, horario y monto a cobrar de la entrega con letra grande: es lo primero que se consulta al salir a entregar. */
export function DeliveryHighlight({ address, schedule, amount = null }: DeliveryHighlightProps) {
  if (!address && !schedule && !amount) {
    return null;
  }

  return (
    <div className="space-y-1.5 rounded-lg border-l-4 border-indigo-500 bg-zinc-100 px-3 py-2 text-left text-lg font-bold leading-snug text-slate-900 dark:bg-zinc-800/60">
      {address && (
        <p className="flex items-start gap-2">
          <MapPin className="mt-1 h-5 w-5 shrink-0 text-indigo-500" />
          <span>{address}</span>
        </p>
      )}
      {schedule && (
        <p className="flex items-start gap-2 text-brand-800">
          <CalendarClock className="mt-1 h-5 w-5 shrink-0 text-brand-500" />
          <span>{schedule}</span>
        </p>
      )}
      {amount && (
        <p className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
          <Banknote className="mt-1 h-5 w-5 shrink-0" />
          <span>{amount}</span>
        </p>
      )}
    </div>
  );
}
