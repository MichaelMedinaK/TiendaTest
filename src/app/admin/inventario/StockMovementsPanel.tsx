'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

import { type InventoryProduct, type ManualMovementView, registerMovement } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import {
  BADGE_CLASS,
  CARD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  TABLE_CELL_CLASS,
  TABLE_CLASS,
  TABLE_HEAD_CELL_CLASS,
} from '@/components/ui/styles';
import { formatDateTime, formatProductLabel } from '@/lib/format';
import { MOVEMENT_TYPE_LABELS } from '@/lib/labels';

interface StockMovementsPanelProps {
  products: InventoryProduct[];
  /** Entradas y salidas manuales ya registradas (no incluye las que vienen de ventas). */
  movements: ManualMovementView[];
}

/** Registra entradas y salidas de stock que no vienen de una venta y las lista en una tabla. */
export function StockMovementsPanel({ products, movements }: StockMovementsPanelProps) {
  return (
    <div className="space-y-4">
      <MovementForm products={products} />
      <MovementsLog movements={movements} />
    </div>
  );
}

function MovementForm({ products }: { products: InventoryProduct[] }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [inventoryItemId, setInventoryItemId] = useState(products[0]?.inventoryItemId ?? '');
  const [type, setType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (products.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <FeedbackMessage tone="error" message="Primero agrega productos al inventario para poder registrar entradas o salidas" />
      </div>
    );
  }

  const selectedProduct = products.find((product) => product.inventoryItemId === inventoryItemId);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await registerMovement(inventoryItemId, {
        type,
        quantity: Number(formData.get('quantity')),
        reason: String(formData.get('reason') ?? ''),
      });

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      // El panel sigue abierto para registrar varios movimientos seguidos.
      form.reset();
      feedback.success(`${type === 'ENTRY' ? 'Entrada' : 'Salida'} registrada. "${result.data.name}" ahora tiene ${result.data.stock}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} space-y-4`}>
      <h2 className="text-lg font-semibold text-slate-900">Entrada o salida de stock</h2>
      <p className="text-sm text-slate-500">Para movimientos que no salen por una venta (las ventas descuentan solas).</p>

      <div className="grid gap-4 sm:grid-cols-6">
        <div className="sm:col-span-4">
          <label className={LABEL_CLASS} htmlFor="movement-product">
            Producto
          </label>
          <select
            id="movement-product"
            className={INPUT_CLASS}
            value={inventoryItemId}
            onChange={(event) => setInventoryItemId(event.target.value)}
          >
            {products.map((product) => (
              <option key={product.inventoryItemId} value={product.inventoryItemId}>
                {formatProductLabel(product)} (hay {product.stock})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="movement-type">
            Movimiento
          </label>
          <select
            id="movement-type"
            className={INPUT_CLASS}
            value={type}
            onChange={(event) => setType(event.target.value as 'ENTRY' | 'EXIT')}
          >
            <option value="ENTRY">{MOVEMENT_TYPE_LABELS.ENTRY}</option>
            <option value="EXIT">{MOVEMENT_TYPE_LABELS.EXIT}</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="movement-quantity">
            Cantidad
          </label>
          <input
            id="movement-quantity"
            name="quantity"
            type="number"
            min={1}
            step={1}
            max={type === 'EXIT' ? selectedProduct?.stock : undefined}
            required
            className={INPUT_CLASS}
          />
        </div>

        <div className="sm:col-span-4">
          <label className={LABEL_CLASS} htmlFor="movement-reason">
            Motivo (obligatorio)
          </label>
          <input
            id="movement-reason"
            name="reason"
            required
            maxLength={500}
            className={INPUT_CLASS}
            placeholder={type === 'ENTRY' ? 'Ej. Recibi mercancia de Juan' : 'Ej. Producto danado o regalo a un cliente'}
          />
        </div>
      </div>

      {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}

      <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
        {isPending ? 'Guardando...' : `Registrar ${type === 'ENTRY' ? 'entrada' : 'salida'}`}
      </button>
    </form>
  );
}

function MovementsLog({ movements }: { movements: ManualMovementView[] }) {
  if (movements.length === 0) {
    return <div className={`${CARD_CLASS} text-sm text-slate-500`}>Todavia no hay entradas ni salidas registradas.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className={TABLE_CLASS}>
        <thead className="bg-brand-50">
          <tr>
            <th className={TABLE_HEAD_CELL_CLASS}>Fecha</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Movimiento</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Producto</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Cantidad</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Motivo</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Registrado por</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {movements.map((movement) => {
            const isEntry = movement.quantity > 0;

            return (
              <tr key={movement.id}>
                <td className={`${TABLE_CELL_CLASS} whitespace-nowrap`}>{formatDateTime(new Date(movement.createdAt))}</td>
                <td className={TABLE_CELL_CLASS}>
                  <span className={`${BADGE_CLASS} ${isEntry ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {MOVEMENT_TYPE_LABELS[movement.type]}
                  </span>
                </td>
                <td className={TABLE_CELL_CLASS}>{formatProductLabel({ name: movement.productName, sku: movement.productSku })}</td>
                <td className={`${TABLE_CELL_CLASS} font-semibold ${isEntry ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isEntry ? '+' : ''}
                  {movement.quantity}
                </td>
                <td className={TABLE_CELL_CLASS}>{movement.reason}</td>
                <td className={TABLE_CELL_CLASS}>{movement.userName}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
