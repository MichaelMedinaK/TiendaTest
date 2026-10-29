'use client';

import { LogIn } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

import { login } from '@/actions/auth';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { ROLE_HOME_ROUTE } from '@/lib/permissions';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    setErrorMessage(null);

    startTransition(async () => {
      const result = await login(email, password);

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      // refresh() obliga a recargar el layout del panel con la sesion recien creada.
      router.replace(searchParams.get('redirectTo') ?? ROLE_HOME_ROUTE[result.data.role]);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={LABEL_CLASS} htmlFor="email">
          Usuario
        </label>
        <input
          id="email"
          name="email"
          type="text"
          autoComplete="username"
          required
          placeholder="admin"
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="password">
          Contrasena
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="********"
          className={INPUT_CLASS}
        />
      </div>

      {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}

      <button type="submit" className={`${PRIMARY_BUTTON_CLASS} w-full`} disabled={isPending}>
        <LogIn className="h-4 w-4" />
        {isPending ? 'Validando...' : 'Ingresar'}
      </button>
    </form>
  );
}
