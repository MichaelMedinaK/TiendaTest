import { getOrders } from '@/actions/orders';
import { getProducts } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';

import { OrderForm } from './OrderForm';
import { OrdersTable } from './OrdersTable';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const [productsResult, ordersResult] = await Promise.all([getProducts(), getOrders()]);

  if (!productsResult.success || !ordersResult.success) {
    const errorMessage = !productsResult.success ? productsResult.error : (ordersResult as { error: string }).error;
    return <FeedbackMessage tone="error" message={errorMessage} />;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
        <p className="text-sm text-slate-500">Registra, edita y elimina ventas del stock disponible</p>
      </header>

      <OrderForm products={productsResult.data} />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Historial de ventas</h2>
        <OrdersTable orders={ordersResult.data} products={productsResult.data} />
      </div>
    </section>
  );
}
