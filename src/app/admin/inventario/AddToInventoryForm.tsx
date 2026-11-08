'use client';

import { PackagePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

import { type CatalogOption, addToInventory } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { formatProductLabel } from '@/lib/format';

interface AddToInventoryFormProps {
  ownerId: string;
  /** Productos del catalogo que todavia no estan en este inventario. */
  catalog: CatalogOption[];
  onDone: () => void;
}

export function AddToInventoryForm({ ownerId, catalog, onDone }: AddToInventoryFormProps) {
  const router = useRouter();
  const toast = useFeedback();
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (catalog.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <FeedbackMessage
          tone="error"
          message="No hay productos del catalogo por agregar. El administrador crea los productos nuevos en Catalogo"
        />
      </div>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFeedback(null);

    startTransition(async () => {
      const result = await addToInventory({
        productId: String(formData.get('productId') ?? ''),
        quantity: Number(formData.get('quantity')),
        reason: String(formData.get('reason') ?? ''),
        ownerId,
      });

      if (!result.success) {
        setFeedback({ tone: 'error', message: result.error });
        return;
      }

      toast.success(`"${result.data.name}" agregado al inventario`);
      router.refresh();
      onDone();
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} space-y-4`}>
      <h2 className="text-lg font-semibold text-slate-900">Agregar producto al inventario</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="productId">
            Producto del catalogo
          </label>
          <select id="productId" name="productId" required className={INPUT_CLASS}>
            {catalog.map((product) => (
              <option key={product.id} value={product.id}>
                {formatProductLabel(product)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Los precios los define el administrador en el catalogo.</p>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="quantity">
            Stock inicial
          </label>
          <input id="quantity" name="quantity" type="number" min={0} step={1} defaultValue={0} required className={INPUT_CLASS} />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="reason">
            Descripcion del stock
          </label>
          <input
            id="reason"
            name="reason"
            maxLength={500}
            defaultValue="Stock inicial"
            className={INPUT_CLASS}
            placeholder="Obligatoria si hay stock"
          />
        </div>
      </div>

      {feedback && <FeedbackMessage tone={feedback.tone} message={feedback.message} />}

      <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
        <PackagePlus className="h-4 w-4" />
        {isPending ? 'Guardando...' : 'Agregar al inventario'}
      </button>
    </form>
  );
}
