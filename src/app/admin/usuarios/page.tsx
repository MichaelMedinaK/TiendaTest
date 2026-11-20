import { getUsers } from '@/actions/users';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { getCurrentSession } from '@/lib/session';

import { NewUserForm } from './NewUserForm';
import { UsersTable } from './UsersTable';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const [result, session] = await Promise.all([getUsers(), getCurrentSession()]);

  // Un usuario que no es ADMIN recibe aqui el error de permisos de la Server Action.
  if (!result.success) {
    return <FeedbackMessage tone="error" message={result.error} />;
  }

  // Quien puede abastecer a un revendedor: tenderos y administradores activos.
  const suppliers = result.data
    .filter((user) => user.isActive && (user.role === 'STAFF' || user.role === 'ADMIN'))
    .map(({ id, name, email }) => ({ id, name, email }));

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500">Crea cuentas y controla el acceso al panel</p>
      </header>

      <NewUserForm suppliers={suppliers} />
      <UsersTable users={result.data} suppliers={suppliers} currentUserId={session?.userId ?? null} />
    </section>
  );
}
