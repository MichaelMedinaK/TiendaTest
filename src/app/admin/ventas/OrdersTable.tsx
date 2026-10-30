'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { DeliveryStatus } from '@prisma/client';

import { type OrderWithItems, deleteOrder, updateDeliveryStatus } from '@/actions/orders';
import type { InventoryProduct } from '@/actions/products';
import { OrderItemsList } from '@/components/OrderItemsList';
import { PaymentsPanel, PaymentsSummary } from '@/components/PaymentsControl';
import { StatusSelect } from '@/components/StatusSelect';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import {
  CARD_CLASS,
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
import { formatCurrency, formatDateTime, formatSchedule, formatShipping, formatUserLabel } from '@/lib/format';
import { DELIVERY_METHOD_LABELS, DELIVERY_STATUS_LABELS, PAYMENT_METHOD_LABELS, toSelectOptions } from '@/lib/labels';

import { OrderForm } from './OrderForm';

const DELIVERY_STATUS_OPTIONS = toSelectOptions(DELIVERY_STATUS_LABELS);
const COLUMN_COUNT = 7;

export function OrdersTable({
  orders,
  products,
  showSeller = false,
}: {
  orders: OrderWithItems[];
  products: InventoryProduct[];
  /** Muestra de que inventario salio cada venta (util para el administrador). */
  showSeller?: boolean;
}) {
  const router = useRouter();
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [paymentsOrderId, setPaymentsOrderId] = useState<string | null>(null);

  // Tras persistir un cambio se refresca el server component para recalcular stock y metricas.
  const refreshAfter = async <TResult,>(action: Promise<TResult>): Promise<TResult> => {
    const result = await action;
    router.refresh();
    return result;
  };

  if (orders.length === 0) {
    return <div className={`${CARD_CLASS} text-sm text-slate-500`}>Aun no se han registrado ventas.</div>;
  }

  return (
    <div className={STACKED_WRAPPER_CLASS}>
      <table className={STACKED_TABLE_CLASS}>
        <thead className={STACKED_HEAD_CLASS}>
          <tr>
            <th className={TABLE_HEAD_CELL_CLASS}>Venta</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Fecha</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Productos</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Pago</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Total</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Envio</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Acciones</th>
          </tr>
        </thead>
        {orders.map((order) => (
          <tbody
            key={order.id}
            className={`${STACKED_GROUP_CLASS} ${editingOrderId === order.id ? STACKED_GROUP_ACTIVE_CLASS : ''}`}
          >
            <tr className={STACKED_ROW_CLASS}>
              <td data-label="Venta" className={STACKED_TITLE_CELL_CLASS}>
                <p>{order.reference}</p>
                {showSeller && (
                  <p className="text-xs font-normal text-brand-600">Vendedor: {formatUserLabel(order.seller)}</p>
                )}
                <p className="text-xs font-normal text-slate-500">
                  {DELIVERY_METHOD_LABELS[order.deliveryMethod]}
                  {order.address ? ` - ${order.address}` : ''}
                </p>
                {formatSchedule(order) && <p className="text-xs font-normal text-slate-500">{formatSchedule(order)}</p>}
                {formatShipping(order) && <p className="text-xs font-normal text-slate-500">{formatShipping(order)}</p>}
              </td>
              <td data-label="Fecha" className={`${STACKED_CELL_CLASS} whitespace-nowrap`}>{formatDateTime(order.createdAt)}</td>
              <td data-label="Productos" className={STACKED_CELL_CLASS}>
                <OrderItemsList items={order.items} />
              </td>
              <td data-label="Pago" className={STACKED_CELL_CLASS}>
                <div className="flex flex-col items-end gap-1 md:items-start">
                  <p className="text-xs text-slate-500">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
                  <PaymentsSummary
                    order={order}
                    isOpen={paymentsOrderId === order.id}
                    onToggle={() => setPaymentsOrderId(paymentsOrderId === order.id ? null : order.id)}
                  />
                </div>
              </td>
              <td data-label="Total" className={`${STACKED_CELL_CLASS} font-semibold`}>{formatCurrency(order.total)}</td>
              <td data-label="Envio" className={STACKED_CELL_CLASS}>
                <StatusSelect<DeliveryStatus>
                  ariaLabel={`Estado del envio de ${order.reference}`}
                  value={order.deliveryStatus}
                  options={DELIVERY_STATUS_OPTIONS}
                  onChangeAction={(nextStatus) => refreshAfter(updateDeliveryStatus(order.id, nextStatus))}
                />
              </td>
              <td data-label="Acciones" className={STACKED_CELL_CLASS}>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => setEditingOrderId(editingOrderId === order.id ? null : order.id)}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                  <DeleteOrderButton orderId={order.id} reference={order.reference} />
                </div>
              </td>
            </tr>

            {paymentsOrderId === order.id && (
              <tr className={STACKED_EDIT_ROW_CLASS}>
                <td colSpan={COLUMN_COUNT} className={STACKED_EDIT_CELL_CLASS}>
                  <PaymentsPanel order={order} />
                </td>
              </tr>
            )}

            {editingOrderId === order.id && (
              <tr className={STACKED_EDIT_ROW_CLASS}>
                <td colSpan={COLUMN_COUNT} className={STACKED_EDIT_CELL_CLASS}>
                  <OrderForm products={products} order={order} onFinished={() => setEditingOrderId(null)} />
                </td>
              </tr>
            )}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function DeleteOrderButton({ orderId, reference }: { orderId: string; reference: string }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [isPending, startTransition] = useTransition();

  const handleDelete = async () => {
    const confirmed = await feedback.confirm({
      title: 'Eliminar venta',
      message: `Se eliminara la venta "${reference}" y su stock volvera al inventario.`,
    });

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteOrder(orderId);

      if (!result.success) {
        feedback.error(result.error);
        return;
      }

      feedback.success(`Venta "${reference}" eliminada`);
      router.refresh();
    });
  };

  return (
    <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={isPending} onClick={handleDelete}>
      <Trash2 className="h-4 w-4 text-rose-600" />
      {isPending ? 'Eliminando' : 'Eliminar'}
    </button>
  );
}
