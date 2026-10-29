import { Store } from 'lucide-react';
import { Suspense } from 'react';

import { CARD_CLASS } from '@/components/ui/styles';

import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className={`${CARD_CLASS} w-full max-w-sm`}>
        <div className="mb-6 text-center">
          <Store className="mx-auto mb-2 h-8 w-8 text-brand-600" />
          <h1 className="text-xl font-bold text-slate-900">Tienda Test</h1>
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
