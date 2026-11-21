'use client';

import { Clock, Pencil, Search, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { DeliveryStatus, PaymentStatus } from '@prisma/client';

import { type OrderWithItems, deleteOrder, updateDeliveryStatus } from '@/actions/orders';
import type { InventoryProduct } from '@/actions/products';
import { PaidByMethod, PaymentsPanel } from '@/components/PaymentsControl';
import { StatusSelect } from '@/components/StatusSelect';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { CARD_CLASS } from '@/components/ui/styles';
import {
  formatCurrency,
  formatDateTime,
  formatExtraAmount,
  formatProductLabel,
  formatSchedule,
  formatUserLabel,
} from '@/lib/format';
import {
  DELIVERY_METHOD_LABELS,
  DELIVERY_STATUS_LABELS,
  ORDER_KIND_LABELS,
  toSelectOptions,
} from '@/lib/labels';
import { getBalance, getPaidAmount } from '@/lib/payments-view';
import type { ShippingRate } from '@/lib/shipping';

import { OrderForm } from './OrderForm';

const DELIVERY_STATUS_OPTIONS = toSelectOptions(DELIVERY_STATUS_LABELS);
const COLUMN_COUNT = 7;
const ALL = 'ALL';

type PaymentFilter = typeof ALL | PaymentStatus;
type DeliveryFilter = typeof ALL | DeliveryStatus;

const PAYMENT_FILTER_OPTIONS: { value: PaymentFilter; label: string }[] = [
  { value: ALL, label: 'Todos' },
  { value: 'PAID', label: 'Pagado' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PARTIAL', label: 'Parcial' },
];

const DELIVERY_FILTER_OPTIONS: { value: DeliveryFilter; label: string }[] = [
  { value: ALL, label: 'Todos' },
  ...DELIVERY_STATUS_OPTIONS,
];

const PAYMENT_BADGES: Record<PaymentStatus, { label: string; className: string }> = {
  PENDING: {
    label: 'Pendiente',
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  PARTIAL: {
    label: 'Parcial',
    className: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  },
  PAID: {
    label: 'Pagado',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
};

const DELIVERY_SELECT_TONES: Record<DeliveryStatus, string> = {
  PENDING: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  PACKED: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  IN_TRANSIT: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  DELIVERED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  CANCELLED: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
};

const MUTED_TEXT = 'text-zinc-500 dark:text-zinc-400';
const STRONG_TEXT = 'text-zinc-900 dark:text-white';
// Planilla: bordes horizontales sutiles y divisiones verticales suaves entre columnas.
const SHEET_ROW_DIVIDERS = 'divide-x divide-zinc-200/70 dark:divide-zinc-800/50';
const SHEET_ROW_BORDER = 'border-zinc-200 dark:border-zinc-800/80';
const HEAD_CELL_CLASS =
  'px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const CELL_CLASS = 'px-3 py-2.5 align-top';
const FILTER_CONTROL_CLASS =
  'h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const ICON_BUTTON_CLASS =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400';

const getDeliverySelectClassName = (status: DeliveryStatus) =>
  `h-7 w-full min-w-[7.5rem] rounded-md border px-2 text-xs font-medium outline-none transition focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 ${DELIVERY_SELECT_TONES[status]}`;

interface MetaPart {
  key: string;
  text: string;
  className?: string;
}

/** Segunda linea de la venta: tipo de entrega, km, envio, monto a cobrar y vendedor, separados por "·". */
function buildMetaParts(order: OrderWithItems, showSeller: boolean): MetaPart[] {
  const extraAmount = formatExtraAmount(order);
  const parts: (MetaPart | null)[] = [
    {
      key: 'kind',
      text: order.kind === 'ERRAND' ? ORDER_KIND_LABELS.ERRAND : DELIVERY_METHOD_LABELS[order.deliveryMethod],
    },
    order.distanceKm !== null ? { key: 'km', text: `${order.distanceKm} km` } : null,
    order.shippingPrice > 0 ? { key: 'shipping', text: `Envio ${formatCurrency(order.shippingPrice)}` } : null,
    extraAmount ? { key: 'extra', text: extraAmount, className: 'font-medium text-indigo-600 dark:text-indigo-400' } : null,
    showSeller ? { key: 'seller', text: formatUserLabel(order.seller), className: 'text-zinc-600 dark:text-zinc-300' } : null,
  ];

  return parts.filter((part): part is MetaPart => part !== null);
}

/** Minusculas y sin tildes para que "Peru" encuentre "Perú". */
const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function buildSearchText(order: OrderWithItems): string {
  return normalizeText(
    [
      order.reference,
      order.address ?? '',
      formatUserLabel(order.seller),
      ...order.items.map((item) => formatProductLabel(item.product)),
    ].join(' '),
  );
}

export function OrdersTable({
  orders,
  products,
  shippingRate,
  showSeller = false,
}: {
  orders: OrderWithItems[];
  products: InventoryProduct[];
  shippingRate: ShippingRate;
  /** Muestra de que inventario salio cada venta (util para el administrador). */
  showSeller?: boolean;
}) {
  const router = useRouter();
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [paymentsOrderId, setPaymentsOrderId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>(ALL);
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>(ALL);

  // Tras persistir un cambio se refresca el server component para recalcular stock y metricas.
  const refreshAfter = async <TResult,>(action: Promise<TResult>): Promise<TResult> => {
    const result = await action;
    router.refresh();
    return result;
  };

  if (orders.length === 0) {
    return <div className={`${CARD_CLASS} text-sm ${MUTED_TEXT}`}>Aun no se han registrado ventas.</div>;
  }

  const normalizedSearch = normalizeText(searchText.trim());
  const visibleOrders = orders.filter(
    (order) =>
      (paymentFilter === ALL || order.paymentStatus === paymentFilter) &&
      (deliveryFilter === ALL || order.deliveryStatus === deliveryFilter) &&
      (normalizedSearch === '' || buildSearchText(order).includes(normalizedSearch)),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            aria-label="Buscar ventas"
            placeholder="Buscar por direccion, cliente o producto..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className={`${FILTER_CONTROL_CLASS} w-full pl-9 placeholder:text-zinc-400 dark:placeholder:text-zinc-500`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className={`flex items-center gap-2 text-xs ${MUTED_TEXT}`}>
            Pago
            <select
              className={FILTER_CONTROL_CLASS}
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
            >
              {PAYMENT_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={`flex items-center gap-2 text-xs ${MUTED_TEXT}`}>
            Envio
            <select
              className={FILTER_CONTROL_CLASS}
              value={deliveryFilter}
              onChange={(event) => setDeliveryFilter(event.target.value as DeliveryFilter)}
            >
              {DELIVERY_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <p className={`text-xs tabular-nums ${MUTED_TEXT}`}>
            {visibleOrders.length} de {orders.length}
          </p>
        </div>
      </div>

      <div className={`overflow-x-auto rounded-xl border bg-white dark:bg-zinc-900/40 ${SHEET_ROW_BORDER}`}>
        <table className="w-full min-w-[60rem] border-collapse text-sm">
          <thead className={`border-b bg-zinc-50 dark:bg-zinc-900/80 ${SHEET_ROW_BORDER}`}>
            <tr className={SHEET_ROW_DIVIDERS}>
              <th className={HEAD_CELL_CLASS}>Venta / Destino</th>
              <th className={HEAD_CELL_CLASS}>Fecha</th>
              <th className={HEAD_CELL_CLASS}>Productos</th>
              <th className={HEAD_CELL_CLASS}>Pago</th>
              <th className={`${HEAD_CELL_CLASS} text-right`}>Total</th>
              <th className={HEAD_CELL_CLASS}>Envio</th>
              <th className={HEAD_CELL_CLASS}>Acciones</th>
            </tr>
          </thead>

          {visibleOrders.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={COLUMN_COUNT} className={`px-4 py-8 text-center text-sm ${MUTED_TEXT}`}>
                  Ninguna venta coincide con los filtros.
                </td>
              </tr>
            </tbody>
          )}

          {visibleOrders.map((order) => {
            const schedule = formatSchedule(order);
            const metaParts = buildMetaParts(order, showSeller);
            const [createdDay, createdTime] = formatDateTime(order.createdAt).split(' ');
            const paymentBadge = PAYMENT_BADGES[order.paymentStatus];
            const paidAmount = getPaidAmount(order.payments);
            const canCollect = getBalance(order.total, order.payments) > 0 && order.deliveryStatus !== 'CANCELLED';
            const isPaymentsOpen = paymentsOrderId === order.id;

            return (
              <tbody
                key={order.id}
                className={`border-b last:border-b-0 ${SHEET_ROW_BORDER} ${
                  editingOrderId === order.id ? 'bg-indigo-500/5' : ''
                }`}
              >
                <tr className={`transition hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${SHEET_ROW_DIVIDERS}`}>
                  <td className={`${CELL_CLASS} min-w-[18rem] max-w-md`}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={`text-sm tabular-nums ${order.address ? `font-medium ${MUTED_TEXT}` : `font-medium ${STRONG_TEXT}`}`}
                      >
                        {order.reference}
                      </span>
                      {order.address && (
                        <span className={`text-sm font-medium ${STRONG_TEXT}`}>{order.address}</span>
                      )}
                      {schedule && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-zinc-200 bg-zinc-100 px-1.5 py-px text-[11px] font-medium tabular-nums text-zinc-700 dark:border-zinc-700/80 dark:bg-zinc-800/80 dark:text-zinc-200">
                          <Clock className="h-3 w-3" />
                          {schedule}
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 text-xs tabular-nums ${MUTED_TEXT}`}>
                      {metaParts.map((part, index) => (
                        <span key={part.key}>
                          {index > 0 && <span className="px-1 text-zinc-400 dark:text-zinc-600">·</span>}
                          <span className={part.className}>{part.text}</span>
                        </span>
                      ))}
                    </p>
                  </td>

                  <td className={`${CELL_CLASS} whitespace-nowrap tabular-nums`}>
                    <p className={`text-xs font-medium ${STRONG_TEXT}`}>{createdDay}</p>
                    <p className={`text-xs ${MUTED_TEXT}`}>{createdTime}</p>
                  </td>

                  <td className={`${CELL_CLASS} min-w-[12rem]`}>
                    {order.items.length === 0 ? (
                      <p className="text-xs text-zinc-500">— Sin productos</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {order.items.map((item) => (
                          <li key={item.id} className="text-[13px] leading-5 text-zinc-700 dark:text-zinc-200">
                            <span className={`font-semibold tabular-nums ${STRONG_TEXT}`}>{item.quantity}x</span>{' '}
                            {formatProductLabel(item.product)}
                            <span className={`ml-1.5 text-xs tabular-nums ${MUTED_TEXT}`}>
                              {formatCurrency(item.unitPrice)} c/u
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>

                  <td className={`${CELL_CLASS} whitespace-nowrap`}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-px text-[11px] font-medium ${paymentBadge.className}`}
                      >
                        {paymentBadge.label}
                      </span>
                      <button
                        type="button"
                        aria-expanded={isPaymentsOpen}
                        className="text-xs font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                        onClick={() => setPaymentsOrderId(isPaymentsOpen ? null : order.id)}
                      >
                        {canCollect ? '+ Cobrar' : 'Cobros'}
                      </button>
                    </div>
                    <PaidByMethod order={order} className={`mt-1 text-xs tabular-nums ${MUTED_TEXT}`} />
                    {order.paymentStatus === 'PARTIAL' && (
                      <p className={`text-xs tabular-nums ${MUTED_TEXT}`}>
                        Cobrado {formatCurrency(paidAmount)} de {formatCurrency(order.total)}
                      </p>
                    )}
                  </td>

                  <td className={`${CELL_CLASS} whitespace-nowrap text-right`}>
                    <span className={`text-sm font-semibold tabular-nums ${STRONG_TEXT}`}>
                      {formatCurrency(order.total)}
                    </span>
                  </td>

                  <td className={CELL_CLASS}>
                    <StatusSelect<DeliveryStatus>
                      ariaLabel={`Estado del envio de ${order.reference}`}
                      value={order.deliveryStatus}
                      options={DELIVERY_STATUS_OPTIONS}
                      getSelectClassName={getDeliverySelectClassName}
                      onChangeAction={(nextStatus) => refreshAfter(updateDeliveryStatus(order.id, nextStatus))}
                    />
                  </td>

                  <td className={CELL_CLASS}>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Editar venta"
                        aria-label={`Editar ${order.reference}`}
                        aria-expanded={editingOrderId === order.id}
                        className={`${ICON_BUTTON_CLASS} hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white`}
                        onClick={() => setEditingOrderId(editingOrderId === order.id ? null : order.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <DeleteOrderButton orderId={order.id} reference={order.reference} />
                    </div>
                  </td>
                </tr>

                {isPaymentsOpen && (
                  <tr className={`border-t bg-zinc-50 dark:bg-zinc-900/60 ${SHEET_ROW_BORDER}`}>
                    <td colSpan={COLUMN_COUNT} className="p-4">
                      <PaymentsPanel order={order} />
                    </td>
                  </tr>
                )}

                {editingOrderId === order.id && (
                  <tr className={`border-t bg-zinc-50 dark:bg-zinc-900/60 ${SHEET_ROW_BORDER}`}>
                    <td colSpan={COLUMN_COUNT} className="p-4">
                      <OrderForm
                        products={products}
                        shippingRate={shippingRate}
                        order={order}
                        onFinished={() => setEditingOrderId(null)}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
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
    <button
      type="button"
      title={isPending ? 'Eliminando...' : 'Eliminar venta'}
      aria-label={`Eliminar ${reference}`}
      className={`${ICON_BUTTON_CLASS} hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400`}
      disabled={isPending}
      onClick={handleDelete}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
