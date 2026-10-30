'use client';

import { KeyRound } from 'lucide-react';
import { FormEvent, useState, useTransition } from 'react';

import { changeOwnPassword } from '@/actions/users';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';

export function ChangePasswordForm() {
  const toast = useFeedback();
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const newPassword = String(formData.get('newPassword') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');
    setFeedback(null);

    if (newPassword !== confirmPassword) {
      setFeedback({ tone: 'error', message: 'La confirmacion no coincide con la clave nueva' });
      return;
    }

    startTransition(async () => {
      const result = await changeOwnPassword(String(formData.get('currentPassword') ?? ''), newPassword);

      if (!result.success) {
        setFeedback({ tone: 'error', message: result.error });
        return;
      }

      form.reset();
      toast.success('Tu clave fue actualizada');
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} max-w-md space-y-4`}>
      <h2 className="text-lg font-semibold text-slate-900">Cambiar mi clave</h2>

      <div>
        <label className={LABEL_CLASS} htmlFor="currentPassword">
          Clave actual
        </label>
        <input id="currentPassword" name="currentPassword" type="password" required className={INPUT_CLASS} />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="newPassword">
          Clave nueva
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={6}
          className={INPUT_CLASS}
          placeholder="Minimo 6 caracteres"
        />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="confirmPassword">
          Confirmar clave nueva
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          className={INPUT_CLASS}
        />
      </div>

      {feedback && <FeedbackMessage tone={feedback.tone} message={feedback.message} />}

      <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
        <KeyRound className="h-4 w-4" />
        {isPending ? 'Guardando...' : 'Actualizar clave'}
      </button>
    </form>
  );
}
