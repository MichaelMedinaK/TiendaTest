'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

import { type CatalogProduct, deleteCatalogProduct, updateCatalogProduct } from '@/actions/catalog';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import {
  CARD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  STACKED_CELL_CLASS,
  STACKED_EDIT_CELL_CLASS,
  STACKED_EDIT_ROW_CLASS,
  STACKED_GROUP_ACTIVE_CLASS,
  STACKED_GROUP_CLASS,
  STACKED_HEAD_CLASS,
  STACKED_ROW_CLASS,
  STACKED_TABLE_CLASS,
  STACKED_TITLE_CELL_CLASS,
  STACKED_WRAPPER_CLASS,
  TABLE_HEAD_CELL_CLASS,
} from '@/components/ui/styles';
import { formatProductLabel } from '@/lib/format';

const COLUMN_COUNT = 3;

export function CatalogTable({ products }: { products: CatalogProduct[] }) {
  if (products.length === 0) {
    return <div className={`${CARD_CLASS} text-sm text-slate-500`}>Todavia no hay productos en el catalogo.</div>;
  }

  return (
    <div className={STACKED_WRAPPER_CLASS}>
      <table className={STACKED_TABLE_CLASS}>
        <thead className={STACKED_HEAD_CLASS}>
          <tr>
            <th className={TABLE_HEAD_CELL_CLASS}>Producto - SKU</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Uso</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Acciones</th>
          </tr>
        </thead>
        {products.map((product) => (
          <CatalogRow key={product.id} product={product} />
        ))}
      </table>
    </div>
  );
}

function CatalogRow({ product }: { product: CatalogProduct }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = async () => {
    const confirmed = await feedback.confirm({
      title: 'Eliminar producto',
      message: `Se eliminara "${product.name}" del catalogo. Esta accion no se puede deshacer.`,
    });

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteCatalogProduct(product.id);

      if (!result.success) {
        feedback.error(result.error);
        return;
      }

      feedback.success(`Producto "${product.name}" eliminado`);
      router.refresh();
    });
  };

  return (
    <tbody className={`${STACKED_GROUP_CLASS} ${isEditing ? STACKED_GROUP_ACTIVE_CLASS : ''}`}>
      <tr className={STACKED_ROW_CLASS}>
        <td data-label="Producto" className={STACKED_TITLE_CELL_CLASS}>{formatProductLabel(product)}</td>
        <td data-label="Uso" className={STACKED_CELL_CLASS}>
          {product.inventoriesCount} inventario(s) - {product.salesCount} venta(s)
        </td>
        <td data-label="Acciones" className={STACKED_CELL_CLASS}>
          <div className="flex gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              aria-label={`Editar ${product.name}`}
              onClick={() => setIsEditing((editing) => !editing)}
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              aria-label={`Eliminar ${product.name}`}
              disabled={isPending}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              Eliminar
            </button>
          </div>
        </td>
      </tr>

      {isEditing && (
        <tr className={STACKED_EDIT_ROW_CLASS}>
          <td colSpan={COLUMN_COUNT} className={STACKED_EDIT_CELL_CLASS}>
            <EditCatalogForm product={product} onFinished={() => setIsEditing(false)} />
          </td>
        </tr>
      )}
    </tbody>
  );
}

function EditCatalogForm({ product, onFinished }: { product: CatalogProduct; onFinished: () => void }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await updateCatalogProduct(product.id, {
        name: String(formData.get('name') ?? ''),
        sku: String(formData.get('sku') ?? ''),
      });

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      feedback.success(`Producto "${formatProductLabel(result.data)}" actualizado`);
      router.refresh();
      onFinished();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor={`name-${product.id}`}>
            Nombre
          </label>
          <input
            id={`name-${product.id}`}
            name="name"
            required
            maxLength={255}
            defaultValue={product.name}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor={`sku-${product.id}`}>
            SKU
          </label>
          <input
            id={`sku-${product.id}`}
            name="sku"
            maxLength={50}
            defaultValue={product.sku ?? ''}
            className={INPUT_CLASS}
            placeholder="Opcional"
          />
        </div>
      </div>

      {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}

      <div className="flex gap-2">
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onFinished} disabled={isPending}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
