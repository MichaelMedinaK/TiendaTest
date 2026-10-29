import { getDeliveries } from '@/actions/orders';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';

import { DeliveriesList } from './DeliveriesList';

export const dynamic = 'force-dynamic';

export default async function DeliveriesPage() {
  const result = await getDeliveries();

  if (!result.success) {
    return <FeedbackMessage tone="error" message={result.error} />;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Entregas</h1>
        <p className="text-sm text-slate-500">Domicilios pendientes y en camino</p>
      </header>

      <DeliveriesList deliveries={result.data} />
    </section>
  );
}
