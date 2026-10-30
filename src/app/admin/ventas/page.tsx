import { redirect } from 'next/navigation';

import { getOrders } from '@/actions/orders';
import { getInventoryOwners, getProducts } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { LOGIN_ROUTE } from '@/lib/constants';
import { getCurrentSession } from '@/lib/session';

import { NewSalePanel } from './NewSalePanel';
import { OrdersTable } from './OrdersTable';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
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

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
        <p className="text-sm text-slate-500">Registra, edita y elimina ventas del stock disponible</p>
      </header>

      <NewSalePanel products={productsResult.data} sellers={ownersResult.data} currentUserId={session.userId} />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Historial de ventas</h2>
        <OrdersTable
          orders={ordersResult.data}
          products={productsResult.data}
          showSeller={session.role === 'ADMIN'}
        />
      </div>
    </section>
  );
}
