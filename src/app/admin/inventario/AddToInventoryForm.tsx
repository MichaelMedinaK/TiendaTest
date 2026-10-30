'use client';

import { PackagePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

import { createProduct } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';

export function NewProductForm() {
  const router = useRouter();
  const toast = useFeedback();
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setFeedback(null);

    startTransition(async () => {
      const result = await createProduct({
        name: String(formData.get('name') ?? ''),
        sku: String(formData.get('sku') ?? ''),
        price: Number(formData.get('price')),
        stock: Number(formData.get('stock')),
      });

      if (!result.success) {
        setFeedback({ tone: 'error', message: result.error });
        return;
      }

      form.reset();
      toast.success(`Producto "${result.data.name}" creado`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} space-y-4`}>
      <h2 className="text-lg font-semibold text-slate-900">Agregar producto</h2>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="name">
            Nombre
          </label>
          <input id="name" name="name" required className={INPUT_CLASS} placeholder="Camiseta basica" />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="sku">
            SKU
          </label>
          <input id="sku" name="sku" className={INPUT_CLASS} placeholder="CAM-001" />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="price">
            Precio
          </label>
          <input id="price" name="price" type="number" min={0.01} step={0.01} required className={INPUT_CLASS} />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="stock">
            Stock inicial
          </label>
          <input id="stock" name="stock" type="number" min={0} step={1} defaultValue={0} required className={INPUT_CLASS} />
        </div>
      </div>

      {feedback && <FeedbackMessage tone={feedback.tone} message={feedback.message} />}

      <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
        <PackagePlus className="h-4 w-4" />
        {isPending ? 'Guardando...' : 'Agregar producto'}
      </button>
    </form>
  );
}
