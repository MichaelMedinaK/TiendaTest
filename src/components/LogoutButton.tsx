'use client';

import { LogOut } from 'lucide-react';
import { useTransition } from 'react';

import { logout } from '@/actions/auth';
import { SECONDARY_BUTTON_CLASS } from '@/components/ui/styles';

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={SECONDARY_BUTTON_CLASS}
      disabled={isPending}
      onClick={() => startTransition(() => logout())}
    >
      <LogOut className="h-4 w-4" />
      {isPending ? 'Saliendo...' : 'Cerrar sesion'}
    </button>
  );
}
