'use client';

import { Pencil, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

import type { Product } from '@prisma/client';

import { deleteProduct, updateProductDetails, updateStock } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import {
  BADGE_CLASS,
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
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { formatCurrency, formatProductLabel } from '@/lib/format';

const COLUMN_COUNT = 4;

export function InventoryTable({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <div className={`${CARD_CLASS} text-sm text-slate-500`}>Todavia no hay productos registrados.</div>;
  }

  return (
    <div className={STACKED_WRAPPER_CLASS}>
      <table className={STACKED_TABLE_CLASS}>
        <thead className={STACKED_HEAD_CLASS}>
          <tr>
            <th className={TABLE_HEAD_CELL_CLASS}>Producto - SKU</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Precio</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Stock</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Actualizar stock</th>
          </tr>
        </thead>
        {products.map((product) => (
          <ProductRow key={product.id} product={product} />
        ))}
      </table>
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [stockValue, setStockValue] = useState<number>(product.stock);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isLowStock = product.stock <= LOW_STOCK_THRESHOLD;
  const hasChanges = stockValue !== product.stock;

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateStock(product.id, stockValue);

      if (!result.success) {
        setStockValue(product.stock);
        feedback.error(result.error);
        return;
      }

      feedback.success(`Stock de "${product.name}" actualizado a ${stockValue}`);
      router.refresh();
    });
  };

  const handleDelete = async () => {
    const confirmed = await feedback.confirm({
      title: 'Eliminar producto',
      message: `Se eliminara "${product.name}". Esta accion no se puede deshacer.`,
    });

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteProduct(product.id);

      if (!result.success) {
        feedback.error(result.error);
        return;
      }

      feedback.success(`Producto "${product.name}" eliminado`);
      router.refresh();
    });
  };

  const productLabel = formatProductLabel(product);

  return (
    <tbody className={`${STACKED_GROUP_CLASS} ${isEditingDetails ? STACKED_GROUP_ACTIVE_CLASS : ''}`}>
      <tr className={STACKED_ROW_CLASS}>
        <td data-label="Producto" className={STACKED_TITLE_CELL_CLASS}>{productLabel}</td>
        <td data-label="Precio" className={STACKED_CELL_CLASS}>{formatCurrency(product.price)}</td>
        <td data-label="Stock" className={STACKED_CELL_CLASS}>
          <span className={`${BADGE_CLASS} ${isLowStock ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {product.stock} {isLowStock ? '(bajo)' : ''}
          </span>
        </td>
        <td data-label="Actualizar stock" className={STACKED_CELL_CLASS}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label={`Nuevo stock de ${product.name}`}
              type="number"
              min={0}
              step={1}
              className={`${INPUT_CLASS} w-24 py-1.5`}
              value={stockValue}
              disabled={isPending}
              onChange={(event) => setStockValue(Number(event.target.value))}
            />
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={isPending || !hasChanges}
              onClick={handleSave}
            >
              <Save className="h-4 w-4" />
              {isPending ? 'Guardando' : 'Guardar'}
            </button>
            <button
              type="button"
              aria-label={`Editar nombre y SKU de ${product.name}`}
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setIsEditingDetails((isEditing) => !isEditing)}
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
            <button
              type="button"
              aria-label={`Eliminar ${product.name}`}
              className={SECONDARY_BUTTON_CLASS}
              disabled={isPending}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              Eliminar
            </button>
          </div>
        </td>
      </tr>

      {isEditingDetails && (
        <tr className={STACKED_EDIT_ROW_CLASS}>
          <td colSpan={COLUMN_COUNT} className={STACKED_EDIT_CELL_CLASS}>
            <EditProductDetailsForm product={product} onFinished={() => setIsEditingDetails(false)} />
          </td>
        </tr>
      )}
    </tbody>
  );
}

function EditProductDetailsForm({ product, onFinished }: { product: Product; onFinished: () => void }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await updateProductDetails(product.id, {
        name: String(formData.get('name') ?? ''),
        sku: String(formData.get('sku') ?? ''),
        price: Number(formData.get('price')),
      });

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      const label = formatProductLabel(result.data);
      const { updatedOrdersCount } = result.data;
      const priceChanged = result.data.price !== product.price;

      feedback.success(
        !priceChanged
          ? `Producto "${label}" actualizado`
          : updatedOrdersCount > 0
            ? `Producto "${label}" actualizado. Se recalcularon ${updatedOrdersCount} venta(s) pendiente(s) con el nuevo precio`
            : `Producto "${label}" actualizado. Ninguna venta pendiente tenia el precio anterior`,
      );
      router.refresh();
      onFinished();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-semibold text-brand-600">Editando: {formatProductLabel(product)}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
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
        <div>
          <label className={LABEL_CLASS} htmlFor={`price-${product.id}`}>
            Precio
          </label>
          <input
            id={`price-${product.id}`}
            name="price"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            required
            defaultValue={product.price}
            className={INPUT_CLASS}
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
