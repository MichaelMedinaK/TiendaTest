'use client';

import { KeyRound } from 'lucide-react';
import { FormEvent, useState, useTransition } from 'react';

import { resetUserPassword } from '@/actions/users';
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles';

interface ResetPasswordControlProps {
  userId: string;
  userEmail: string;
}

/** Permite al ADMIN asignar una clave nueva a cualquier usuario desde la tabla. */
export function ResetPasswordControl({ userId, userEmail }: ResetPasswordControlProps) {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newPassword = String(new FormData(event.currentTarget).get('newPassword') ?? '');
    setErrorMessage(null);
    setFeedbackMessage(null);

    startTransition(async () => {
      const result = await resetUserPassword(userId, newPassword);

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      setIsFormVisible(false);
      setFeedbackMessage('Clave actualizada');
    });
  };

  if (!isFormVisible) {
    return (
      <div>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setIsFormVisible(true)}>
          <KeyRound className="h-4 w-4" />
          Cambiar clave
        </button>
        {feedbackMessage && <span className="mt-1 block text-xs text-emerald-600">{feedbackMessage}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        aria-label={`Nueva clave de ${userEmail}`}
        name="newPassword"
        type="password"
        required
        minLength={6}
        placeholder="Minimo 6 caracteres"
        className={`${INPUT_CLASS} w-44 py-1.5`}
      />
      <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
        {isPending ? 'Guardando...' : 'Guardar'}
      </button>
      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setIsFormVisible(false)}>
        Cancelar
      </button>
      {errorMessage && <span className="block w-full text-xs text-rose-600">{errorMessage}</span>}
    </form>
  );
}
