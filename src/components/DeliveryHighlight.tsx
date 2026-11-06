import { CalendarClock, MapPin } from 'lucide-react';

/** Direccion y horario de entrega con letra grande: es lo primero que se consulta al salir a entregar. */
export function DeliveryHighlight({ address, schedule }: { address: string | null; schedule: string | null }) {
  if (!address && !schedule) {
    return null;
  }

  return (
    <div className="space-y-1.5 rounded-lg border-l-4 border-pink-500 bg-gradient-to-r from-brand-50 to-pink-50 px-3 py-2 text-left text-lg font-bold leading-snug text-slate-900">
      {address && (
        <p className="flex items-start gap-2">
          <MapPin className="mt-1 h-5 w-5 shrink-0 text-pink-500" />
          <span>{address}</span>
        </p>
      )}
      {schedule && (
        <p className="flex items-start gap-2 text-brand-800">
          <CalendarClock className="mt-1 h-5 w-5 shrink-0 text-brand-500" />
          <span>{schedule}</span>
        </p>
      )}
    </div>
  );
}
