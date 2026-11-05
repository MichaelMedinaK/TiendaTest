import { redirect } from 'next/navigation';

import { getAvailableCatalog, getInventoryOwners, getManualMovements, getProducts } from '@/actions/products';
import { OwnerSelect } from '@/components/OwnerSelect';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { LOGIN_ROUTE } from '@/lib/constants';
import { formatUserLabel } from '@/lib/format';
import { getCurrentSession } from '@/lib/session';

import { InventoryActions } from './InventoryActions';
import { InventoryTable } from './InventoryTable';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<{ duenio?: string }> }) {
  const { duenio } = (await searchParams) ?? {};
  const session = await getCurrentSession();

  if (!session) {
    redirect(LOGIN_ROUTE);
  }

  // Un tendero siempre ve su inventario; el administrador puede elegir el de cualquier usuario.
  const isAdmin = session.role === 'ADMIN';
  const ownerId = isAdmin && duenio && duenio !== 'ALL' ? duenio : session.userId;
  const [ownersResult, productsResult, catalogResult, movementsResult] = await Promise.all([
    getInventoryOwners(),
    getProducts(ownerId),
    getAvailableCatalog(ownerId),
    getManualMovements(ownerId),
  ]);

  if (!productsResult.success) {
    return <FeedbackMessage tone="error" message={productsResult.error} />;
  }

  if (!ownersResult.success) {
    return <FeedbackMessage tone="error" message={ownersResult.error} />;
  }

  if (!catalogResult.success) {
    return <FeedbackMessage tone="error" message={catalogResult.error} />;
  }

  if (!movementsResult.success) {
    return <FeedbackMessage tone="error" message={movementsResult.error} />;
  }

  const owner = ownersResult.data.find((candidate) => candidate.id === ownerId);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Inventario</h1>
        <p className="text-sm text-slate-500">
          Stock, precio real y precio de venta{owner ? ` de ${formatUserLabel(owner)}` : ''}
        </p>
      </header>

      {isAdmin && <OwnerSelect owners={ownersResult.data} value={ownerId} />}

      <InventoryActions
        ownerId={ownerId}
        catalog={catalogResult.data}
        products={productsResult.data}
        movements={movementsResult.data}
      />
      <InventoryTable products={productsResult.data} />
    </section>
  );
}
