import { DeliveryStatus, PaymentStatus } from '@prisma/client';
import Link from 'next/link';

import { type OrderWithItems, getOrders } from '@/actions/orders';
import { getProducts } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { DASHBOARD_ROUTE, OPEN_DELIVERY_STATUSES } from '@/lib/constants';
import { getStoreDayKey } from '@/lib/format';
import { DELIVERY_STATUS_LABELS, toSelectOptions } from '@/lib/labels';
import { getCurrentSession } from '@/lib/session';
import { readShippingRate } from '@/lib/shipping-rate';

import { QuickAccess } from './QuickAccess';
import { SalesBoard } from './SalesBoard';

// La lista depende de la sesion y cambia con cada venta: nunca se cachea.
export const dynamic = 'force-dynamic';

type DayKey = 'actuales' | 'ayer' | 'hoy' | 'manana' | 'todas';

interface DayFilter {
  key: DayKey;
  label: string;
  title: string;
  /** Dias respecto a hoy; sin valor, el filtro no se limita a un dia concreto. */
  offset?: number;
}

const DAY_FILTERS: DayFilter[] = [
  { key: 'actuales', label: 'Actuales', title: 'Ventas actuales' },
  { key: 'ayer', label: 'Ayer', title: 'Ventas de ayer', offset: -1 },
  { key: 'hoy', label: 'Hoy', title: 'Ventas de hoy', offset: 0 },
  { key: 'manana', label: 'Manana', title: 'Ventas de manana', offset: 1 },
  { key: 'todas', label: 'Todas', title: 'Todas las ventas' },
];

const DEFAULT_DAY_FILTER = DAY_FILTERS[0];
const STATUS_OPTIONS = toSelectOptions(DELIVERY_STATUS_LABELS);

function buildHref(day: DayKey, status: DeliveryStatus | null): string {
  const params = new URLSearchParams();

  if (day !== DEFAULT_DAY_FILTER.key) {
    params.set('dia', day);
  }

  if (status) {
    params.set('estado', status);
  }

  const query = params.toString();

  return query ? `${DASHBOARD_ROUTE}?${query}` : DASHBOARD_ROUTE;
}

/** Venta actual: sigue en curso, o ya se entrego pero falta cobrarla (las canceladas se consideran cerradas). */
function isCurrentOrder(order: OrderWithItems): boolean {
  const isOpenDelivery = OPEN_DELIVERY_STATUSES.includes(order.deliveryStatus);
  const isDeliveredUnpaid =
    order.deliveryStatus === DeliveryStatus.DELIVERED && order.paymentStatus !== PaymentStatus.PAID;

  return isOpenDelivery || isDeliveredUnpaid;
}

/** Fecha y hora programadas ascendentes; las ventas sin fecha van al final, por orden de registro. */
function compareBySchedule(first: OrderWithItems, second: OrderWithItems): number {
  const firstDate = first.scheduledDate?.getTime() ?? Number.POSITIVE_INFINITY;
  const secondDate = second.scheduledDate?.getTime() ?? Number.POSITIVE_INFINITY;

  if (firstDate !== secondDate) {
    return firstDate < secondDate ? -1 : 1;
  }

  const timeComparison = (first.scheduledFrom ?? '99:99').localeCompare(second.scheduledFrom ?? '99:99');

  return timeComparison !== 0 ? timeComparison : first.createdAt.getTime() - second.createdAt.getTime();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ dia?: string; estado?: string }>;
}) {
  const { dia, estado } = (await searchParams) ?? {};
  const [ordersResult, productsResult, session] = await Promise.all([
    getOrders(),
    getProducts('ALL'),
    getCurrentSession(),
  ]);

  if (!ordersResult.success) {
    return <FeedbackMessage tone="error" message={ordersResult.error} />;
  }

  if (!productsResult.success) {
    return <FeedbackMessage tone="error" message={productsResult.error} />;
  }

  const dayFilter = DAY_FILTERS.find(({ key }) => key === dia) ?? DEFAULT_DAY_FILTER;
  const statusFilter = Object.values(DeliveryStatus).find((status) => status === estado) ?? null;
  const targetDay = dayFilter.offset === undefined ? null : getStoreDayKey(dayFilter.offset);

  const matchesDay = (order: OrderWithItems): boolean => {
    if (dayFilter.key === DEFAULT_DAY_FILTER.key) {
      return isCurrentOrder(order);
    }

    return targetDay === null || order.scheduledDate?.toISOString().slice(0, 10) === targetDay;
  };

  const orders = ordersResult.data
    .filter((order) => matchesDay(order) && (!statusFilter || order.deliveryStatus === statusFilter))
    .sort(compareBySchedule);

  // Las ventas cerradas (canceladas, entregadas y cobradas) no estan en "Actuales": al elegir un estado se busca entre todas.
  const dayForStatusLinks = dayFilter.key === DEFAULT_DAY_FILTER.key ? 'todas' : dayFilter.key;

  return (
    <section className="space-y-6">
      <header className="space-y-4">
        {session && <QuickAccess role={session.role} />}

        <div className="space-y-2">
          <nav className="flex flex-wrap gap-2" aria-label="Filtro por fecha">
            {DAY_FILTERS.map(({ key, label }) => (
              <ViewTab
                key={key}
                href={buildHref(key, statusFilter)}
                label={label}
                isActive={dayFilter.key === key}
              />
            ))}
          </nav>

          <nav className="flex flex-wrap gap-2" aria-label="Filtro por estado">
            <ViewTab href={buildHref(dayFilter.key, null)} label="Todos los estados" isActive={!statusFilter} />
            {STATUS_OPTIONS.map(({ value, label }) => (
              <ViewTab
                key={value}
                href={buildHref(dayForStatusLinks, value)}
                label={label}
                isActive={statusFilter === value}
              />
            ))}
          </nav>
        </div>

        <p className="text-sm text-slate-500">
          {dayFilter.title}
          {statusFilter ? ` - ${DELIVERY_STATUS_LABELS[statusFilter]}` : ''} ordenadas por fecha de entrega ({orders.length})
        </p>
      </header>

      <SalesBoard
        orders={orders}
        products={productsResult.data}
        shippingRate={readShippingRate()}
        showSeller={session?.role === 'ADMIN'}
      />
    </section>
  );
}

function ViewTab({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        isActive
          ? 'bg-gradient-to-r from-brand-600 to-pink-500 text-white shadow-sm'
          : 'bg-white text-slate-600 ring-1 ring-brand-200 hover:bg-pink-50 hover:text-pink-700 hover:ring-pink-300'
      }`}
    >
      {label}
    </Link>
  );
}
