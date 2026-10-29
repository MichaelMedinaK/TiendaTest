'use client';

import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { Product } from '@prisma/client';

import { updateStock } from '@/actions/products';
import {
  BADGE_CLASS,
  CARD_CLASS,
  INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_CELL_CLASS,
  TABLE_CLASS,
  TABLE_HEAD_CELL_CLASS,
} from '@/components/ui/styles';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';

export function InventoryTable({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <div className={`${CARD_CLASS} text-sm text-slate-500`}>Todavia no hay productos registrados.</div>;
  }

  return (
    <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
      <table className={TABLE_CLASS}>
        <thead className="bg-slate-50">
          <tr>
            <th className={TABLE_HEAD_CELL_CLASS}>Producto</th>
            <th className={TABLE_HEAD_CELL_CLASS}>SKU</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Precio</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Stock</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Actualizar stock</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  const router = useRouter();
  const [stockValue, setStockValue] = useState<number>(product.stock);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isLowStock = product.stock <= LOW_STOCK_THRESHOLD;
  const hasChanges = stockValue !== product.stock;

  const handleSave = () => {
    setErrorMessage(null);

    startTransition(async () => {
      const result = await updateStock(product.id, stockValue);

      if (!result.success) {
        setStockValue(product.stock);
        setErrorMessage(result.error);
        return;
      }

      router.refresh();
    });
  };

  return (
    <tr className="hover:bg-slate-50">
      <td className={`${TABLE_CELL_CLASS} font-medium text-slate-900`}>{product.name}</td>
      <td className={TABLE_CELL_CLASS}>{product.sku ?? '-'}</td>
      <td className={TABLE_CELL_CLASS}>{formatCurrency(product.price)}</td>
      <td className={TABLE_CELL_CLASS}>
        <span className={`${BADGE_CLASS} ${isLowStock ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {product.stock} {isLowStock ? '(bajo)' : ''}
        </span>
      </td>
      <td className={TABLE_CELL_CLASS}>
        <div className="flex items-center gap-2">
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
        </div>
        {errorMessage && <span className="mt-1 block text-xs text-rose-600">{errorMessage}</span>}
      </td>
    </tr>
  );
}
