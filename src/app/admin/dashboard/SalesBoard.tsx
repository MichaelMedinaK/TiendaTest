'use client';

import { Clock, MapPin, Pencil, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { DeliveryStatus } from '@prisma/client';

import { type OrderWithItems, updateDeliveryStatus } from '@/actions/orders';
import type { InventoryProduct } from '@/actions/products';
import { OrderItemsList } from '@/components/OrderItemsList';
import { PaymentsControl } from '@/components/PaymentsControl';
import { StatusSelect } from '@/components/StatusSelect';
import { CARD_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles';
import { NEW_SALE_ANCHOR } from '@/lib/constants';
import { formatCurrency, formatSchedule, formatScheduleDay, formatShipping, formatUserLabel } from '@/lib/format';
import { DELIVERY_METHOD_LABELS, DELIVERY_STATUS_LABELS, toSelectOptions } from '@/lib/labels';

import { OrderForm } from '../ventas/OrderForm';

const DELIVERY_STATUS_OPTIONS = toSelectOptions(DELIVERY_STATUS_LABELS);
const NO_DATE_KEY = 'sin-fecha';

interface OrderGroup {
  key: string;
  title: string;
  orders: OrderWithItems[];
}

/** Agrupa por fecha programada conservando el orden recibido (la fecha ya viene ordenada). */
function groupByScheduledDay(orders: OrderWithItems[]): OrderGroup[] {
  const groups = new Map<string, OrderGroup>();

  for (const order of orders) {
    const key = order.scheduledDate ? order.scheduledDate.toISOString().slice(0, 10) : NO_DATE_KEY;
    const title = order.scheduledDate ? formatScheduleDay(order.scheduledDate) : 'Sin fecha programada';

    if (!groups.has(key)) {
      groups.set(key, { key, title, orders: [] });
    }

    groups.get(key)?.orders.push(order);
  }

  return [...groups.values()];
}

/** Lista de ventas con sus estados, ordenadas por fecha programada, con edicion en el mismo lugar. */
export function SalesBoard({
  orders,
  products,
  showSeller = false,
}: {
  orders: OrderWithItems[];
  products: InventoryProduct[];
  showSeller?: boolean;
}) {
  const router = useRouter();
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <div className={`${CARD_CLASS} flex flex-wrap items-center justify-between gap-3`}>
        <p className="text-sm text-slate-500">No hay ventas para mostrar.</p>
        <Link href={`/admin/ventas#${NEW_SALE_ANCHOR}`} className={PRIMARY_BUTTON_CLASS}>
          Registrar venta
        </Link>
      </div>
    );
  }

  // Tras persistir un cambio se refresca el server component: al cerrarse la venta sale de la lista.
  const refreshAfter = async <TResult,>(action: Promise<TResult>): Promise<TResult> => {
    const result = await action;
    router.refresh();
    return result;
  };

  return (
    <div className="space-y-6">
      {groupByScheduledDay(orders).map((group) => (
        <section key={group.key} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.title}</h2>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.orders.map((order) =>
              editingOrderId === order.id ? (
                <div key={order.id} className="md:col-span-2 xl:col-span-3">
                  <OrderForm products={products} order={order} onFinished={() => setEditingOrderId(null)} />
                </div>
              ) : (
              <article key={order.id} className={`${CARD_CLASS} space-y-3`}>
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{order.reference}</h3>
                    {showSeller && <p className="text-xs text-brand-600">Vendedor: {formatUserLabel(order.seller)}</p>}
                  </div>
                  <p className="shrink-0 text-base font-bold text-slate-900">{formatCurrency(order.total)}</p>
                </header>

                {formatSchedule(order) && (
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Clock className="h-4 w-4 shrink-0 text-brand-600" />
                    {formatSchedule(order)}
                  </p>
                )}

                <p className="flex items-start gap-2 text-sm text-slate-700">
                  {order.address ? (
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  ) : (
                    <Store className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  )}
                  <span>
                    {DELIVERY_METHOD_LABELS[order.deliveryMethod]}
                    {order.address ? ` - ${order.address}` : ''}
                    {formatShipping(order) && <span className="block text-xs text-slate-500">{formatShipping(order)}</span>}
                  </span>
                </p>

                <OrderItemsList items={order.items} />

                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <PaymentsControl order={order} />
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">Envio</p>
                    <StatusSelect<DeliveryStatus>
                      ariaLabel={`Estado del envio de ${order.reference}`}
                      value={order.deliveryStatus}
                      options={DELIVERY_STATUS_OPTIONS}
                      onChangeAction={(nextStatus) => refreshAfter(updateDeliveryStatus(order.id, nextStatus))}
                    />
                  </div>
                </div>

                <button type="button" className={`${SECONDARY_BUTTON_CLASS} w-full`} onClick={() => setEditingOrderId(order.id)}>
                  <Pencil className="h-4 w-4" />
                  Modificar venta
                </button>
              </article>
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
