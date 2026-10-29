import { AlertTriangle, Clock, DollarSign, Truck } from 'lucide-react';

import { getDashboardMetrics } from '@/actions/dashboard';
import { MetricCard } from '@/components/MetricCard';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { formatCurrency } from '@/lib/format';

// Las metricas dependen de la sesion y cambian con cada venta: nunca se cachean.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const result = await getDashboardMetrics();

  if (!result.success) {
    return <FeedbackMessage tone="error" message={result.error} />;
  }

  const metrics = result.data;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Resumen operativo de la tienda</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Ventas totales"
          value={formatCurrency(metrics.totalSalesAmount)}
          helperText={`${metrics.paidOrdersCount} ventas pagadas`}
          icon={DollarSign}
          accentClass="text-emerald-600"
        />
        <MetricCard
          label="Pagos pendientes"
          value={String(metrics.unpaidOrdersCount)}
          helperText="Ventas sin pagar"
          icon={Clock}
          accentClass="text-amber-500"
        />
        <MetricCard
          label="Envios pendientes"
          value={String(metrics.pendingDeliveriesCount)}
          helperText="Pendientes o en transito"
          icon={Truck}
          accentClass="text-sky-600"
        />
        <MetricCard
          label="Stock bajo"
          value={String(metrics.lowStockProductsCount)}
          helperText={`Productos con ${metrics.lowStockThreshold} unidades o menos`}
          icon={AlertTriangle}
          accentClass="text-rose-600"
        />
      </div>
    </section>
  );
}
