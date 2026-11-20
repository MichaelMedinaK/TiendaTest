'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useTransition } from 'react';

import type { InventoryProduct } from '@/actions/products';
import { setSalePrice } from '@/actions/pricing';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { INPUT_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles';
import { formatCurrency } from '@/lib/format';

/** Precio al que vende el dueno este producto; vacio vuelve al precio del catalogo. */
export function SalePriceForm({ product }: { product: InventoryProduct }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [isPending, startTransition] = useTransition();

  const save = (salePrice: string | null) => {
    startTransition(async () => {
      const result = await setSalePrice(product.inventoryItemId, salePrice);

      if (!result.success) {
        feedback.error(result.error);
        return;
      }

      feedback.success(`"${product.name}" ahora se vende a ${formatCurrency(result.data.price)}`);
      router.refresh();
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save(String(new FormData(event.currentTarget).get('salePrice') ?? ''));
  };

  return (
    <form
      key={`${product.inventoryItemId}-${product.price}`}
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2"
    >
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`sale-price-${product.inventoryItemId}`}>
          Mi precio de venta
        </label>
        <input
          id={`sale-price-${product.inventoryItemId}`}
          name="salePrice"
          type="number"
          min={0.01}
          step="any"
          defaultValue={product.price}
          className={`${INPUT_CLASS} w-36 py-1.5`}
        />
      </div>
      <button type="submit" className={SECONDARY_BUTTON_CLASS} disabled={isPending}>
        {isPending ? 'Guardando...' : 'Guardar precio'}
      </button>
      {product.customSalePrice !== null && (
        <button type="button" className="text-xs font-semibold text-brand-600 underline" disabled={isPending} onClick={() => save(null)}>
          Usar el del catalogo
        </button>
      )}
    </form>
  );
}
