import { redirect } from 'next/navigation';

import { getOrders } from '@/actions/orders';
import { getInventoryOwners, getProducts } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { LOGIN_ROUTE } from '@/lib/constants';
import { getStoreDayKey } from '@/lib/format';
import { getPaidByMethod, roundToCents } from '@/lib/payments-view';
import { filterOrdersByPeriod } from '@/lib/report-summary';
import { getCurrentSession } from '@/lib/session';
import { readShippingRate } from '@/lib/shipping-rate';

import { NewSaleButton } from './NewSaleButton';
import { NewSalePanel } from './NewSalePanel';
import { OrdersTable } from './OrdersTable';
import { PeriodSummary, SUMMARY_PERIODS, readSummaryPeriod } from './PeriodSummary';

export const dynamic = 'force-dynamic';

export default async function SalesPage({ searchParams }: { searchParams?: Promise<{ periodo?: string }> }) {
  const session = await getCurrentSession();

  if (!session) {
    redirect(LOGIN_ROUTE);
  }

  // 'ALL': el administrador vende desde cualquier inventario; un tendero recibe solo el suyo.
  const [productsResult, ordersResult, ownersResult] = await Promise.all([
    getProducts('ALL'),
    getOrders(),
    getInventoryOwners(),
  ]);

  if (!productsResult.success || !ordersResult.success || !ownersResult.success) {
    const failure = [productsResult, ordersResult, ownersResult].find((result) => !result.success);
    return <FeedbackMessage tone="error" message={(failure as { error: string }).error} />;
  }

  const shippingRate = readShippingRate();
  // Mismo criterio que el informe: el periodo se toma por la fecha de la venta.
  const period = readSummaryPeriod((await searchParams)?.periodo);
  const periodOrders = filterOrdersByPeriod(ordersResult.data, { from: SUMMARY_PERIODS[period].from(), to: getStoreDayKey() });
  const cashReceived = getPaidByMethod(periodOrders.flatMap((order) => order.payments)).find(
    ({ method }) => method === 'CASH',
  )?.amount ?? 0;
  // El domiciliario gana el envio completo; las ventas canceladas no suman.
  const shippedOrders = periodOrders.filter((order) => order.deliveryStatus !== 'CANCELLED' && order.shippingPrice > 0);
  const shippingTotal = roundToCents(shippedOrders.reduce((accumulated, order) => accumulated + order.shippingPrice, 0));

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Ventas</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Registra, edita y elimina ventas del stock disponible</p>
        </div>
        <NewSaleButton />
      </header>

      <PeriodSummary
        period={period}
        cashReceived={cashReceived}
        shippingTotal={shippingTotal}
        shippingCount={shippedOrders.length}
      />

      <NewSalePanel
        products={productsResult.data}
        shippingRate={shippingRate}
        sellers={ownersResult.data}
        currentUserId={session.userId}
      />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Historial de ventas</h2>
        <OrdersTable
          orders={ordersResult.data}
          products={productsResult.data}
          shippingRate={shippingRate}
          showSeller={session.role === 'ADMIN'}
        />
      </div>
    </section>
  );
}
