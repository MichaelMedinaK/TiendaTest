'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { DeliveryStatus, PaymentStatus, Product } from '@prisma/client';

import { type OrderWithItems, deleteOrder, updateDeliveryStatus, updatePaymentStatus } from '@/actions/orders';
import { StatusSelect } from '@/components/StatusSelect';
import {
  BADGE_CLASS,
  CARD_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_CELL_CLASS,
  TABLE_CLASS,
  TABLE_HEAD_CELL_CLASS,
} from '@/components/ui/styles';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  DELIVERY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_BADGES,
  PAYMENT_STATUS_LABELS,
  toSelectOptions,
} from '@/lib/labels';

import { OrderForm } from './OrderForm';

const PAYMENT_STATUS_OPTIONS = toSelectOptions(PAYMENT_STATUS_LABELS);
const DELIVERY_STATUS_OPTIONS = toSelectOptions(DELIVERY_STATUS_LABELS);
const COLUMN_COUNT = 7;

export function OrdersTable({ orders, products }: { orders: OrderWithItems[]; products: Product[] }) {
  const router = useRouter();
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

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
    <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
      <table className={TABLE_CLASS}>
        <thead className="bg-slate-50">
          <tr>
            <th className={TABLE_HEAD_CELL_CLASS}>Fecha</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Venta</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Productos</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Pago</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Total</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Envio</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => (
            <Fragment key={order.id}>
              <tr className="hover:bg-slate-50">
                <td className={`${TABLE_CELL_CLASS} whitespace-nowrap`}>{formatDateTime(order.createdAt)}</td>
                <td className={TABLE_CELL_CLASS}>
                  <p className="font-medium text-slate-900">{order.description}</p>
                  <p className="text-xs text-slate-500">Ref: {order.reference ?? '-'}</p>
                  <p className="text-xs text-slate-500">{order.address ?? 'Retiro en tienda'}</p>
                </td>
                <td className={TABLE_CELL_CLASS}>
                  <ul className="space-y-0.5 text-xs text-slate-600">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.quantity} x {item.product.name}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className={TABLE_CELL_CLASS}>
                  <p className="mb-1 text-xs text-slate-500">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
                  <span className={`${BADGE_CLASS} ${PAYMENT_STATUS_BADGES[order.paymentStatus]} mb-1`}>
                    {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  </span>
                  <StatusSelect<PaymentStatus>
                    ariaLabel={`Estado del pago de ${order.description}`}
                    value={order.paymentStatus}
                    options={PAYMENT_STATUS_OPTIONS}
                    onChangeAction={(nextStatus) => refreshAfter(updatePaymentStatus(order.id, nextStatus))}
                  />
                </td>
                <td className={`${TABLE_CELL_CLASS} font-semibold`}>{formatCurrency(order.total)}</td>
                <td className={TABLE_CELL_CLASS}>
                  <StatusSelect<DeliveryStatus>
                    ariaLabel={`Estado del envio de ${order.description}`}
                    value={order.deliveryStatus}
                    options={DELIVERY_STATUS_OPTIONS}
                    onChangeAction={(nextStatus) => refreshAfter(updateDeliveryStatus(order.id, nextStatus))}
                  />
                </td>
                <td className={TABLE_CELL_CLASS}>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() => setEditingOrderId(editingOrderId === order.id ? null : order.id)}
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </button>
                    <DeleteOrderButton orderId={order.id} description={order.description} />
                  </div>
                </td>
              </tr>

              {editingOrderId === order.id && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="bg-slate-50 p-4">
                    <OrderForm products={products} order={order} onFinished={() => setEditingOrderId(null)} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeleteOrderButton({ orderId, description }: { orderId: string; description: string }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm(`Eliminar la venta "${description}"? El stock reservado volvera al inventario.`)) {
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      const result = await deleteOrder(orderId);

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      router.refresh();
    });
  };

  return (
    <div>
      <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={isPending} onClick={handleDelete}>
        <Trash2 className="h-4 w-4 text-rose-600" />
        {isPending ? 'Eliminando' : 'Eliminar'}
      </button>
      {errorMessage && <span className="mt-1 block text-xs text-rose-600">{errorMessage}</span>}
    </div>
  );
}
