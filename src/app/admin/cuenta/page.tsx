import { redirect } from 'next/navigation';

import { CARD_CLASS } from '@/components/ui/styles';
import { LOGIN_ROUTE } from '@/lib/constants';
import { ROLE_LABELS } from '@/lib/labels';
import { getCurrentSession } from '@/lib/session';

import { ChangePasswordForm } from './ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect(LOGIN_ROUTE);
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Mi cuenta</h1>
        <p className="text-sm text-slate-500">Datos de tu usuario y cambio de clave</p>
      </header>

      <div className={`${CARD_CLASS} max-w-md space-y-1 text-sm`}>
        <p>
          <span className="text-slate-500">Nombre:</span>{' '}
          <span className="font-medium text-slate-900">{session.name ?? 'Sin nombre'}</span>
        </p>
        <p>
          <span className="text-slate-500">Usuario:</span>{' '}
          <span className="font-medium text-slate-900">{session.email}</span>
        </p>
        <p>
          <span className="text-slate-500">Rol:</span>{' '}
          <span className="font-medium text-slate-900">{ROLE_LABELS[session.role]}</span>
        </p>
      </div>

      <ChangePasswordForm />
    </section>
  );
}
