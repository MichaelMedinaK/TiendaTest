'use client';

import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState, useTransition } from 'react';

import { updateSetting } from '@/actions/settings';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { formatCurrency } from '@/lib/format';
import type { SettingKey, SettingSource } from '@/lib/settings';
import { calculateShippingPrice } from '@/lib/shipping';

export interface SettingField {
  key: SettingKey;
  label: string;
  description: string;
  defaultValue: number;
  value: number;
  source: SettingSource;
  updatedAt: string | null;
  updatedBy: string | null;
}

const PREVIEW_DISTANCES_KM = [2, 5, 8];

function describeSource(field: SettingField): string {
  if (field.source === 'panel') {
    return `Guardado ${field.updatedAt ?? ''}${field.updatedBy ? ` por ${field.updatedBy}` : ''}`.trim();
  }

  return field.source === 'env' ? 'Tomado de la variable de entorno' : `Valor por defecto (${field.defaultValue})`;
}

export function SettingsForm({ fields }: { fields: SettingField[] }) {
  const router = useRouter();
  const toast = useFeedback();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, String(field.value)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const changedFields = fields.filter((field) => Number(values[field.key]) !== field.value);
  const previewRate = {
    ratePerKm: Number(values.DELIVERY_RATE_PER_KM) || 0,
    minPrice: Number(values.DELIVERY_MIN_PRICE) || 0,
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      for (const field of changedFields) {
        const result = await updateSetting(field.key, values[field.key]);

        if (!result.success) {
          setError(result.error);
          router.refresh();
          return;
        }
      }

      toast.success('Parametros guardados. Se aplican a las ventas nuevas o editadas');
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} max-w-2xl space-y-5`}>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Delivery</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Precio del envio = kilometros x tarifa, redondeado hacia arriba y nunca por debajo del minimo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key}>
            <label className={LABEL_CLASS} htmlFor={field.key}>
              {field.label}
            </label>
            <input
              id={field.key}
              name={field.key}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={values[field.key]}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
              className={`${INPUT_CLASS} tabular-nums`}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{field.description}</p>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{describeSource(field)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Vista previa</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums text-zinc-700 dark:text-zinc-200">
          {PREVIEW_DISTANCES_KM.map((distanceKm) => (
            <li key={distanceKm}>
              {distanceKm} km = <span className="font-semibold">{formatCurrency(calculateShippingPrice(distanceKm, previewRate))}</span>
            </li>
          ))}
        </ul>
      </div>

      {error && <FeedbackMessage tone="error" message={error} />}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending || changedFields.length === 0}>
          <Save className="h-4 w-4" />
          {isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Las ventas ya registradas conservan su precio de envio; al editarlas se recalcula con estos valores.
        </p>
      </div>
    </form>
  );
}
