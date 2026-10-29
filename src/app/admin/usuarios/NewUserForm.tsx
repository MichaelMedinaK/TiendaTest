'use client';

import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

import type { Role } from '@prisma/client';

import { createUser } from '@/actions/users';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { ROLE_LABELS, toSelectOptions } from '@/lib/labels';

const ROLE_OPTIONS = toSelectOptions(ROLE_LABELS);

export function NewUserForm() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setFeedback(null);

    startTransition(async () => {
      const result = await createUser({
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? ''),
        role: formData.get('role') as Role,
      });

      if (!result.success) {
        setFeedback({ tone: 'error', message: result.error });
        return;
      }

      form.reset();
      setFeedback({ tone: 'success', message: `Usuario ${result.data.email} creado` });
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} space-y-4`}>
      <h2 className="text-lg font-semibold text-slate-900">Crear usuario</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS} htmlFor="name">
            Nombre
          </label>
          <input id="name" name="name" className={INPUT_CLASS} placeholder="Maria Perez" />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="email">
            Usuario
          </label>
          <input id="email" name="email" type="text" required className={INPUT_CLASS} placeholder="maria" />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="password">
            Contrasena
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className={INPUT_CLASS}
            placeholder="Minimo 6 caracteres"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="role">
            Rol
          </label>
          <select id="role" name="role" className={INPUT_CLASS} defaultValue="STAFF">
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedback && <FeedbackMessage tone={feedback.tone} message={feedback.message} />}

      <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
        <UserPlus className="h-4 w-4" />
        {isPending ? 'Creando...' : 'Crear usuario'}
      </button>
    </form>
  );
}
