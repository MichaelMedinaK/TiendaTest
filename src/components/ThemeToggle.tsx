'use client';

import { Moon, Sun } from 'lucide-react';

import { SECONDARY_BUTTON_CLASS } from '@/components/ui/styles';

export const THEME_STORAGE_KEY = 'theme';

type ThemeToggleVariant = 'sidebar' | 'on-dark' | 'floating';

const VARIANT_STYLES: Record<ThemeToggleVariant, string> = {
  sidebar: `${SECONDARY_BUTTON_CLASS} w-full`,
  'on-dark': 'rounded-lg p-2 text-white transition hover:bg-neutral-800',
  floating:
    'rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:bg-slate-50',
};

/**
 * Alterna entre modo claro y oscuro y recuerda la eleccion. Los iconos y textos se muestran
 * por CSS (`dark:`) para no depender del estado de React y evitar errores de hidratacion.
 */
export function ThemeToggle({ variant }: { variant: ThemeToggleVariant }) {
  const handleToggle = () => {
    const isDark = document.documentElement.classList.toggle('dark');

    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Sin almacenamiento (modo privado): el cambio aplica solo a esta visita.
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label="Cambiar entre modo claro y oscuro"
      title="Cambiar entre modo claro y oscuro"
      className={VARIANT_STYLES[variant]}
    >
      <Sun className="hidden h-5 w-5 dark:block" />
      <Moon className="h-5 w-5 dark:hidden" />
      {variant === 'sidebar' && (
        <>
          <span className="dark:hidden">Modo oscuro</span>
          <span className="hidden dark:inline">Modo claro</span>
        </>
      )}
    </button>
  );
}
