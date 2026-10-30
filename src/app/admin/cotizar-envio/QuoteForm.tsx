'use client';

import { MapPin, Route } from 'lucide-react';
import { FormEvent, useState, useTransition } from 'react';

import { type DeliveryQuote, quoteDelivery } from '@/actions/delivery-quote';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { formatCurrency } from '@/lib/format';

export function QuoteForm() {
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = String(new FormData(event.currentTarget).get('address') ?? '');
    setErrorMessage(null);

    startTransition(async () => {
      const result = await quoteDelivery(address);

      if (!result.success) {
        setQuote(null);
        setErrorMessage(result.error);
        return;
      }

      setQuote(result.data);
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className={`${CARD_CLASS} space-y-4`}>
        <div>
          <label className={LABEL_CLASS} htmlFor="address">
            Direccion de entrega
          </label>
          <input
            id="address"
            name="address"
            required
            maxLength={300}
            className={INPUT_CLASS}
            placeholder="Ej. Av. Larco 345, Miraflores, Lima"
          />
          <p className="mt-1 text-xs text-slate-500">Incluye el distrito o la ciudad para ubicarla con precision</p>
        </div>

        {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}

        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
          <Route className="h-4 w-4" />
          {isPending ? 'Calculando...' : 'Calcular delivery'}
        </button>
      </form>

      {quote && (
        <article className={`${CARD_CLASS} space-y-3`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Precio del delivery</p>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(quote.price)}</p>
          <p className="text-sm text-slate-600">
            {quote.distanceKm} km x {formatCurrency(quote.ratePerKm)} por km, redondeado hacia arriba
          </p>
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <span>
              Desde {quote.originLabel} hasta: {quote.destination}
            </span>
          </p>
        </article>
      )}
    </div>
  );
}
