import { DeliveryStatus, PaymentStatus } from '@prisma/client';
import Link from 'next/link';

import { type OrderWithItems, getOrders } from '@/actions/orders';
import { getProducts } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { OPEN_DELIVERY_STATUSES } from '@/lib/constants';
import { getCurrentSession } from '@/lib/session';

import { SalesBoard } from './SalesBoard';

// La lista depende de la sesion y cambia con cada venta: nunca se cachea.
export const dynamic = 'force-dynamic';

const ALL_VIEW = 'todas';

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

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<{ ver?: string }> }) {
  const { ver } = (await searchParams) ?? {};
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

  const showAll = ver === ALL_VIEW;
  const orders = (showAll ? ordersResult.data : ordersResult.data.filter(isCurrentOrder)).sort(compareBySchedule);

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inicio</h1>
          <p className="text-sm text-slate-500">
            {showAll ? 'Todas las ventas' : 'Ventas actuales'} ordenadas por fecha de entrega ({orders.length})
          </p>
        </div>

        <nav className="flex gap-2" aria-label="Filtro de ventas">
          <ViewTab href="/admin/dashboard" label="Actuales" isActive={!showAll} />
          <ViewTab href={`/admin/dashboard?ver=${ALL_VIEW}`} label="Todas" isActive={showAll} />
        </nav>
      </header>

      <SalesBoard orders={orders} products={productsResult.data} showSeller={session?.role === 'ADMIN'} />
    </section>
  );
}

function ViewTab({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        isActive ? 'bg-slate-900 text-white dark:text-black' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </Link>
  );
}
