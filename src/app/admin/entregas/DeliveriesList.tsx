'use client';

import { Clock, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { DeliveryStatus, PaymentMethod } from '@prisma/client';

import { type OrderWithItems, updateDeliveryStatus, updatePaymentMethod } from '@/actions/orders';
import { OrderItemsList } from '@/components/OrderItemsList';
import { PaymentsControl } from '@/components/PaymentsControl';
import { StatusSelect } from '@/components/StatusSelect';
import { CARD_CLASS } from '@/components/ui/styles';
import { formatDateTime, formatSchedule, formatShipping } from '@/lib/format';
import { DELIVERY_STATUS_LABELS, PAYMENT_METHOD_LABELS, toSelectOptions } from '@/lib/labels';

const DELIVERY_STATUS_OPTIONS = toSelectOptions(DELIVERY_STATUS_LABELS);
const PAYMENT_METHOD_OPTIONS = toSelectOptions(PAYMENT_METHOD_LABELS);

export function DeliveriesList({ deliveries }: { deliveries: OrderWithItems[] }) {
  const router = useRouter();

  if (deliveries.length === 0) {
    return <div className={`${CARD_CLASS} text-sm text-slate-500`}>No hay domicilios pendientes.</div>;
  }

  // Al marcar entregado o devuelto el domicilio sale de la lista tras refrescar.
  const refreshAfter = async <TResult,>(action: Promise<TResult>): Promise<TResult> => {
    const result = await action;
    router.refresh();
    return result;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {deliveries.map((order) => (
        <article key={order.id} className={`${CARD_CLASS} space-y-3`}>
          <header className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">{order.reference}</h2>
              <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
            </div>
          </header>

          {formatSchedule(order) && (
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Clock className="h-4 w-4 shrink-0 text-brand-600" />
              {formatSchedule(order)}
            </p>
          )}

          <p className="flex items-start gap-2 text-sm text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            {order.address}
          </p>

          {formatShipping(order) && <p className="text-sm text-slate-600">{formatShipping(order)}</p>}

          <OrderItemsList items={order.items} className="text-sm" />

          <PaymentsControl order={order} />

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Metodo de pago</p>
              <StatusSelect<PaymentMethod>
                ariaLabel={`Metodo de pago de ${order.reference}`}
                value={order.paymentMethod}
                options={PAYMENT_METHOD_OPTIONS}
                onChangeAction={(nextMethod) => refreshAfter(updatePaymentMethod(order.id, nextMethod))}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Pedido</p>
              <StatusSelect<DeliveryStatus>
                ariaLabel={`Estado del envio de ${order.reference}`}
                value={order.deliveryStatus}
                options={DELIVERY_STATUS_OPTIONS}
                onChangeAction={(nextStatus) => refreshAfter(updateDeliveryStatus(order.id, nextStatus))}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
