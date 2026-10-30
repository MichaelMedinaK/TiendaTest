'use client';

import { Menu, Store, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { Role } from '@prisma/client';

import { LogoutButton } from '@/components/LogoutButton';
import { SidebarNavigation } from '@/components/SidebarNavigation';
import { ThemeToggle } from '@/components/ThemeToggle';

interface MobileMenuProps {
  role: Role;
  userName: string;
  roleLabel: string;
  /** Pantalla de inicio del rol; la usa el logo de la tienda. */
  homeHref: string;
}

/** Barra superior oscura con menu desplegable; solo se muestra en celulares. */
export function MobileMenu({ role, userName, roleLabel, homeHref }: MobileMenuProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-800 bg-black text-white md:hidden print:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <Link
          href={homeHref}
          aria-label="Ir al inicio"
          onClick={() => setIsOpen(false)}
          className="flex min-w-0 items-center gap-2 rounded-lg transition hover:opacity-80"
        >
          <Store className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Tienda Test</p>
            <p className="truncate text-xs text-neutral-300">{userName}</p>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle variant="on-dark" />
          <button
            type="button"
            aria-label={isOpen ? 'Cerrar menu' : 'Abrir menu'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
            className="rounded-lg p-2 text-white transition hover:bg-neutral-800"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-neutral-800 px-3 pb-4 pt-2">
          <SidebarNavigation role={role} variant="menu" onNavigate={() => setIsOpen(false)} />
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-800 px-1 pt-3">
            <p className="text-xs text-neutral-300">{roleLabel}</p>
            <LogoutButton />
          </div>
        </div>
      )}
    </header>
  );
}
