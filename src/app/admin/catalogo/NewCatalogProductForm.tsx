'use client';

import { PackagePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

import { createCatalogProduct } from '@/actions/catalog';
import { FormPanel } from '@/components/FormPanel';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { NEW_PRODUCT_ANCHOR } from '@/lib/constants';

export function NewCatalogProductForm() {
  return (
    <FormPanel anchorId={NEW_PRODUCT_ANCHOR} label="Nuevo producto">
      {(close) => <CatalogForm onDone={close} />}
    </FormPanel>
  );
}

function CatalogForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const toast = useFeedback();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await createCatalogProduct({
        name: String(formData.get('name') ?? ''),
        sku: String(formData.get('sku') ?? ''),
        costPrice: Number(formData.get('costPrice')),
        price: Number(formData.get('price')),
      });

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      toast.success(`Producto "${result.data.name}" creado en el catalogo`);
      router.refresh();
      onDone();
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} space-y-4`}>
      <h2 className="text-lg font-semibold text-slate-900">Nuevo producto del catalogo</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className={LABEL_CLASS} htmlFor="name">
            Nombre
          </label>
          <input id="name" name="name" required maxLength={255} className={INPUT_CLASS} placeholder="Anillo de plata" />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="sku">
            SKU
          </label>
          <input id="sku" name="sku" maxLength={50} className={INPUT_CLASS} placeholder="ANI-001" />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="costPrice">
            Precio real (costo)
          </label>
          <input id="costPrice" name="costPrice" type="number" min={0} step="any" defaultValue={0} required className={INPUT_CLASS} />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="price">
            Precio de venta
          </label>
          <input id="price" name="price" type="number" min={0.01} step="any" required className={INPUT_CLASS} />
        </div>
      </div>

      {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}

      <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
        <PackagePlus className="h-4 w-4" />
        {isPending ? 'Guardando...' : 'Crear producto'}
      </button>
    </form>
  );
}
