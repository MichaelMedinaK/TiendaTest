'use client';

import { MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { DeliveryStatus } from '@prisma/client';

import { type OrderWithItems, updateDeliveryStatus } from '@/actions/orders';
import { StatusSelect } from '@/components/StatusSelect';
import { BADGE_CLASS, CARD_CLASS } from '@/components/ui/styles';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  DELIVERY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_BADGES,
  PAYMENT_STATUS_LABELS,
  toSelectOptions,
} from '@/lib/labels';

const DELIVERY_STATUS_OPTIONS = toSelectOptions(DELIVERY_STATUS_LABELS);

export function DeliveriesList({ deliveries }: { deliveries: OrderWithItems[] }) {
  const router = useRouter();

  if (deliveries.length === 0) {
    return <div className={`${CARD_CLASS} text-sm text-slate-500`}>No hay domicilios pendientes.</div>;
  }

  // Al marcar entregado o devuelto el domicilio sale de la lista tras refrescar.
  const changeStatus = async (orderId: string, nextStatus: DeliveryStatus) => {
    const result = await updateDeliveryStatus(orderId, nextStatus);
    router.refresh();
    return result;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {deliveries.map((order) => (
        <article key={order.id} className={`${CARD_CLASS} space-y-3`}>
          <header className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">{order.description}</h2>
              <p className="text-xs text-slate-500">
                {formatDateTime(order.createdAt)} - Ref: {order.reference ?? '-'}
              </p>
            </div>
            <span className={`${BADGE_CLASS} ${PAYMENT_STATUS_BADGES[order.paymentStatus]}`}>
              {PAYMENT_STATUS_LABELS[order.paymentStatus]}
            </span>
          </header>

          <p className="flex items-start gap-2 text-sm text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            {order.address}
          </p>

          <ul className="space-y-0.5 text-sm text-slate-600">
            {order.items.map((item) => (
              <li key={item.id}>
                {item.quantity} x {item.product.name}
              </li>
            ))}
          </ul>

          <p className="text-sm text-slate-600">
            {PAYMENT_METHOD_LABELS[order.paymentMethod]} -{' '}
            <span className="font-semibold text-slate-900">{formatCurrency(order.total)}</span>
          </p>

          <StatusSelect<DeliveryStatus>
            ariaLabel={`Estado del envio de ${order.description}`}
            value={order.deliveryStatus}
            options={DELIVERY_STATUS_OPTIONS}
            onChangeAction={(nextStatus) => changeStatus(order.id, nextStatus)}
          />
        </article>
      ))}
    </div>
  );
}
