import { getCatalog } from '@/actions/catalog';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';

import { CatalogTable } from './CatalogTable';
import { NewCatalogProductForm } from './NewCatalogProductForm';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const result = await getCatalog();

  // Un usuario que no es ADMIN recibe aqui el error de permisos de la Server Action.
  if (!result.success) {
    return <FeedbackMessage tone="error" message={result.error} />;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Catalogo</h1>
        <p className="text-sm text-slate-500">
          Productos generales: cada vendedor los agrega a su inventario con su propio costo, precio y stock
        </p>
      </header>

      <NewCatalogProductForm />
      <CatalogTable products={result.data} />
    </section>
  );
}
