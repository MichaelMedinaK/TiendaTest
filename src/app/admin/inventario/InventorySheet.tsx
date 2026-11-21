'use client';

import { Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useMemo, useState, useTransition } from 'react';

import type { InventoryProduct } from '@/actions/products';
import { type InventorySheetChange, updateInventorySheet } from '@/actions/inventory-sheet';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { formatCurrency, formatProductLabel } from '@/lib/format';

interface Draft {
  stock: string;
  salePrice: string;
  costPrice: string;
}

type Column = keyof Draft;

const HEAD_CELL_CLASS =
  'px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const CELL_CLASS = 'p-0 align-middle';
const DIVIDERS = 'divide-x divide-zinc-200/70 dark:divide-zinc-800/50';
const CELL_INPUT_CLASS =
  'block w-full bg-transparent px-3 py-2 text-right text-sm tabular-nums text-zinc-900 outline-none focus:bg-indigo-500/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:text-white';

const toDraft = (product: InventoryProduct): Draft => ({
  stock: String(product.stock),
  salePrice: String(product.price),
  costPrice: String(product.costPrice),
});

const isSameNumber = (draft: string, original: number) => draft.trim() !== '' && Number(draft) === original;

/** Celdas que el usuario modifico en una fila. Vaciar el precio de venta lo devuelve al del catalogo. */
function getChangedColumns(product: InventoryProduct, draft: Draft, canEditCost: boolean): Record<Column, boolean> {
  return {
    stock: !isSameNumber(draft.stock, product.stock),
    salePrice:
      draft.salePrice.trim() === '' ? product.customSalePrice !== null : !isSameNumber(draft.salePrice, product.price),
    costPrice: canEditCost && !isSameNumber(draft.costPrice, product.costPrice),
  };
}

/** Planilla editable de todo el inventario: cada celda es un campo; solo se guardan las celdas que cambiaron. */
export function InventorySheet({
  ownerId,
  products,
  canEditCost,
  onClose,
}: {
  ownerId: string;
  products: InventoryProduct[];
  /** El precio real solo es editable en inventarios de revendedores; en el resto sale del catalogo. */
  canEditCost: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const feedback = useFeedback();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(products.map((product) => [product.inventoryItemId, toDraft(product)])),
  );
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { changes, stockChangeCount, cellCount } = useMemo(() => {
    const result: InventorySheetChange[] = [];
    let stockCount = 0;
    let cells = 0;

    for (const product of products) {
      const draft = drafts[product.inventoryItemId];
      const changed = getChangedColumns(product, draft, canEditCost);

      if (!changed.stock && !changed.salePrice && !changed.costPrice) {
        continue;
      }

      const change: InventorySheetChange = { inventoryItemId: product.inventoryItemId };

      if (changed.stock) {
        change.stock = { from: product.stock, to: Number(draft.stock) };
        stockCount += 1;
      }

      if (changed.salePrice) {
        change.salePrice = draft.salePrice;
      }

      if (changed.costPrice) {
        change.costPrice = draft.costPrice;
      }

      cells += Number(changed.stock) + Number(changed.salePrice) + Number(changed.costPrice);
      result.push(change);
    }

    return { changes: result, stockChangeCount: stockCount, cellCount: cells };
  }, [drafts, products, canEditCost]);

  const setCell = (inventoryItemId: string, column: Column, value: string) =>
    setDrafts((current) => ({ ...current, [inventoryItemId]: { ...current[inventoryItemId], [column]: value } }));

  // Enter baja a la misma columna de la fila siguiente, como en una planilla.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, column: Column, rowIndex: number) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    const next = document.querySelector<HTMLInputElement>(`[data-sheet-cell="${column}-${rowIndex + 1}"]`);
    next?.focus();
    next?.select();
  };

  const needsReason = stockChangeCount > 0 && reason.trim() === '';
  const canSave = changes.length > 0 && !needsReason && !isPending;

  const handleSave = () => {
    setErrorMessage(null);

    startTransition(async () => {
      const result = await updateInventorySheet(ownerId, changes, reason);

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      feedback.success(
        `Inventario actualizado: ${result.data.updatedCount} ${result.data.updatedCount === 1 ? 'producto' : 'productos'}`,
      );
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
        <p className="text-sm text-zinc-700 dark:text-zinc-200">
          <span className="font-semibold">Editando todo el inventario.</span> Toca una celda y escribe el nuevo valor;
          con Enter bajas a la fila siguiente. Las celdas cambiadas se marcan en amarillo.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400" htmlFor="sheet-reason">
              Descripcion del ajuste de stock {stockChangeCount > 0 ? '(obligatoria)' : '(solo si cambias stock)'}
            </label>
            <input
              id="sheet-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={400}
              placeholder="Ej. Conteo fisico del 21/11"
              className={INPUT_CLASS}
            />
          </div>

          <p className="pb-2 text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
            {cellCount} {cellCount === 1 ? 'cambio' : 'cambios'} en {changes.length}{' '}
            {changes.length === 1 ? 'producto' : 'productos'}
          </p>

          <div className="flex gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!canSave} onClick={handleSave}>
              <Save className="h-4 w-4" />
              {isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={isPending} onClick={onClose}>
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>
        </div>

        {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/80">
            <tr className={DIVIDERS}>
              <th className={HEAD_CELL_CLASS}>Producto - SKU</th>
              <th className={`${HEAD_CELL_CLASS} w-32 text-right`}>Stock</th>
              <th className={`${HEAD_CELL_CLASS} w-36 text-right`}>Precio real</th>
              <th className={`${HEAD_CELL_CLASS} w-36 text-right`}>Precio de venta</th>
              <th className={`${HEAD_CELL_CLASS} w-28 text-right`}>Margen</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, rowIndex) => {
              const draft = drafts[product.inventoryItemId];
              const changed = getChangedColumns(product, draft, canEditCost);
              const margin = (Number(draft.salePrice) || product.price) - (Number(draft.costPrice) || 0);
              const isLowStock = Number(draft.stock) <= LOW_STOCK_THRESHOLD;

              const cellClass = (column: Column) => (changed[column] ? 'bg-amber-400/15' : '');

              return (
                <tr
                  key={product.inventoryItemId}
                  className={`border-b border-zinc-200 last:border-b-0 dark:border-zinc-800/80 ${DIVIDERS}`}
                >
                  <td className="px-3 py-2 align-middle font-medium text-zinc-900 dark:text-white">
                    {formatProductLabel(product)}
                  </td>

                  <td className={`${CELL_CLASS} ${cellClass('stock')}`}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      aria-label={`Stock de ${product.name}`}
                      data-sheet-cell={`stock-${rowIndex}`}
                      value={draft.stock}
                      onChange={(event) => setCell(product.inventoryItemId, 'stock', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, 'stock', rowIndex)}
                      className={`${CELL_INPUT_CLASS} ${isLowStock ? 'text-rose-600 dark:text-rose-400' : ''}`}
                    />
                  </td>

                  <td className={`${CELL_CLASS} ${canEditCost ? cellClass('costPrice') : 'bg-zinc-50 dark:bg-zinc-900/60'}`}>
                    {canEditCost ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        aria-label={`Precio real de ${product.name}`}
                        data-sheet-cell={`costPrice-${rowIndex}`}
                        value={draft.costPrice}
                        onChange={(event) => setCell(product.inventoryItemId, 'costPrice', event.target.value)}
                        onKeyDown={(event) => handleKeyDown(event, 'costPrice', rowIndex)}
                        className={CELL_INPUT_CLASS}
                      />
                    ) : (
                      <span
                        title="Sale del catalogo: se cambia en Catalogo"
                        className="block px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400"
                      >
                        {formatCurrency(product.costPrice)}
                      </span>
                    )}
                  </td>

                  <td className={`${CELL_CLASS} ${cellClass('salePrice')}`}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0.01}
                      step="any"
                      aria-label={`Precio de venta de ${product.name}`}
                      placeholder="Catalogo"
                      data-sheet-cell={`salePrice-${rowIndex}`}
                      value={draft.salePrice}
                      onChange={(event) => setCell(product.inventoryItemId, 'salePrice', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, 'salePrice', rowIndex)}
                      className={CELL_INPUT_CLASS}
                    />
                  </td>

                  <td className="px-3 py-2 text-right align-middle tabular-nums text-zinc-600 dark:text-zinc-300">
                    {formatCurrency(margin)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {needsReason
            ? 'Escribe la descripcion del ajuste de stock arriba para poder guardar.'
            : 'Vaciar el precio de venta lo devuelve al del catalogo. El precio real se cambia en Catalogo, salvo en revendedores.'}
        </p>
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!canSave} onClick={handleSave}>
          <Save className="h-4 w-4" />
          {isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
