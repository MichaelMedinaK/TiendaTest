'use client';

import { Power, PowerOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { type UserSummary, toggleUserStatus } from '@/actions/users';
import {
  BADGE_CLASS,
  CARD_CLASS,
  SECONDARY_BUTTON_CLASS,
  STACKED_CELL_CLASS,
  STACKED_GROUP_CLASS,
  STACKED_HEAD_CLASS,
  STACKED_ROW_CLASS,
  STACKED_TABLE_CLASS,
  STACKED_TITLE_CELL_CLASS,
  STACKED_WRAPPER_CLASS,
  TABLE_HEAD_CELL_CLASS,
} from '@/components/ui/styles';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';

import { ResetPasswordControl } from './ResetPasswordControl';

export function UsersTable({ users }: { users: UserSummary[] }) {
  if (users.length === 0) {
    return <div className={`${CARD_CLASS} text-sm text-slate-500`}>No hay usuarios registrados.</div>;
  }

  return (
    <div className={STACKED_WRAPPER_CLASS}>
      <table className={STACKED_TABLE_CLASS}>
        <thead className={STACKED_HEAD_CLASS}>
          <tr>
            <th className={TABLE_HEAD_CELL_CLASS}>Usuario</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Rol</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Estado</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Creado</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Acceso</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Clave</th>
          </tr>
        </thead>
        {users.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}
      </table>
    </div>
  );
}

function UserRow({ user }: { user: UserSummary }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [isPending, startTransition] = useTransition();

  const handleToggle = async () => {
    if (user.isActive) {
      const confirmed = await feedback.confirm({
        title: 'Desactivar usuario',
        message: `${user.email} ya no podra ingresar al panel hasta que lo vuelvas a activar.`,
        confirmLabel: 'Desactivar',
      });

      if (!confirmed) {
        return;
      }
    }

    startTransition(async () => {
      const result = await toggleUserStatus(user.id, !user.isActive);

      if (!result.success) {
        feedback.error(result.error);
        return;
      }

      feedback.success(`Usuario ${user.email} ${user.isActive ? 'desactivado' : 'activado'}`);
      router.refresh();
    });
  };

  return (
    <tbody className={STACKED_GROUP_CLASS}>
      <tr className={STACKED_ROW_CLASS}>
        <td data-label="Usuario" className={STACKED_TITLE_CELL_CLASS}>
          <p>{user.name ?? 'Sin nombre'}</p>
          <p className="text-xs font-normal text-slate-500">{user.email}</p>
        </td>
        <td data-label="Rol" className={STACKED_CELL_CLASS}>{ROLE_LABELS[user.role]}</td>
        <td data-label="Estado" className={STACKED_CELL_CLASS}>
          <span className={`${BADGE_CLASS} ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
            {user.isActive ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td data-label="Creado" className={`${STACKED_CELL_CLASS} whitespace-nowrap`}>{formatDateTime(user.createdAt)}</td>
        <td data-label="Acceso" className={STACKED_CELL_CLASS}>
          <div>
            <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={isPending} onClick={handleToggle}>
              {user.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
              {user.isActive ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </td>
        <td data-label="Clave" className={STACKED_CELL_CLASS}>
          <ResetPasswordControl userId={user.id} userEmail={user.email} />
        </td>
      </tr>
    </tbody>
  );
}
