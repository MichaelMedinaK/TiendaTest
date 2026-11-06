import { Store } from 'lucide-react';
import { Suspense } from 'react';

import { ThemeToggle } from '@/components/ThemeToggle';
import { CARD_CLASS } from '@/components/ui/styles';

import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="fixed right-4 top-4">
        <ThemeToggle variant="floating" />
      </div>

      <div className={`${CARD_CLASS} w-full max-w-sm`}>
        <div className="mb-6 text-center">
          <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-pink-500 text-white shadow-md">
            <Store className="h-7 w-7" />
          </span>
          <h1 className="bg-gradient-to-r from-brand-500 to-pink-500 bg-clip-text text-xl font-bold text-transparent">
            Tienda Test
          </h1>
          <p className="text-sm text-slate-500">Ingresa con tu cuenta de administrador</p>
        </div>

        {/* useSearchParams exige un limite de Suspense para el prerender estatico. */}
        <Suspense fallback={<p className="text-sm text-slate-500">Cargando formulario...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
