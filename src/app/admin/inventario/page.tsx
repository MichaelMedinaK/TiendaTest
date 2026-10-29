import { getProducts } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';

import { InventoryTable } from './InventoryTable';
import { NewProductForm } from './NewProductForm';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const result = await getProducts();

  if (!result.success) {
    return <FeedbackMessage tone="error" message={result.error} />;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Inventario</h1>
        <p className="text-sm text-slate-500">Controla el stock disponible de cada producto</p>
      </header>

      <NewProductForm />
      <InventoryTable products={result.data} />
    </section>
  );
}
