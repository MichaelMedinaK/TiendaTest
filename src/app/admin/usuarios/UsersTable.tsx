'use client';

import { Power, PowerOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { type UserSummary, toggleUserStatus } from '@/actions/users';
import {
  BADGE_CLASS,
  CARD_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_CELL_CLASS,
  TABLE_CLASS,
  TABLE_HEAD_CELL_CLASS,
} from '@/components/ui/styles';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';

import { ResetPasswordControl } from './ResetPasswordControl';

export function UsersTable({ users }: { users: UserSummary[] }) {
  if (users.length === 0) {
    return <div className={`${CARD_CLASS} text-sm text-slate-500`}>No hay usuarios registrados.</div>;
  }

  return (
    <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
      <table className={TABLE_CLASS}>
        <thead className="bg-slate-50">
          <tr>
            <th className={TABLE_HEAD_CELL_CLASS}>Usuario</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Rol</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Estado</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Creado</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Acceso</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Clave</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ user }: { user: UserSummary }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    setErrorMessage(null);

    startTransition(async () => {
      const result = await toggleUserStatus(user.id, !user.isActive);

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      router.refresh();
    });
  };

  return (
    <tr className="hover:bg-slate-50">
      <td className={TABLE_CELL_CLASS}>
        <p className="font-medium text-slate-900">{user.name ?? 'Sin nombre'}</p>
        <p className="text-xs text-slate-500">{user.email}</p>
      </td>
      <td className={TABLE_CELL_CLASS}>{ROLE_LABELS[user.role]}</td>
      <td className={TABLE_CELL_CLASS}>
        <span className={`${BADGE_CLASS} ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
          {user.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className={`${TABLE_CELL_CLASS} whitespace-nowrap`}>{formatDateTime(user.createdAt)}</td>
      <td className={TABLE_CELL_CLASS}>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={isPending} onClick={handleToggle}>
          {user.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          {user.isActive ? 'Desactivar' : 'Activar'}
        </button>
        {errorMessage && <span className="mt-1 block text-xs text-rose-600">{errorMessage}</span>}
      </td>
      <td className={TABLE_CELL_CLASS}>
        <ResetPasswordControl userId={user.id} userEmail={user.email} />
      </td>
    </tr>
  );
}
