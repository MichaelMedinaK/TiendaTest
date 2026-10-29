import { getUsers } from '@/actions/users';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';

import { NewUserForm } from './NewUserForm';
import { UsersTable } from './UsersTable';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const result = await getUsers();

  // Un usuario que no es ADMIN recibe aqui el error de permisos de la Server Action.
  if (!result.success) {
    return <FeedbackMessage tone="error" message={result.error} />;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500">Crea cuentas y controla el acceso al panel</p>
      </header>

      <NewUserForm />
      <UsersTable users={result.data} />
    </section>
  );
}
