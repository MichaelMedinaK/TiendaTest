'use client';

import { MapPin, Menu, Package, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { Role } from '@prisma/client';

import { SidebarNavigation } from '@/components/SidebarNavigation';
import { CARD_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles';
import { canAccessRoute } from '@/lib/permissions';

const QUICK_LINKS = [
  { href: '/admin/cotizar-envio', label: 'Cotizar envio', icon: MapPin },
  { href: '/admin/inventario', label: 'Stock', icon: Package },
];

/** Accesos rapidos del inicio (cotizar envio y stock) y un desplegable con todas las opciones del menu. */
export function QuickAccess({ role }: { role: Role }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="space-y-3 print:hidden">
      <div className="grid grid-cols-3 gap-2 md:flex">
        {QUICK_LINKS.filter(({ href }) => canAccessRoute(role, href)).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`${PRIMARY_BUTTON_CLASS} px-2 py-3 md:px-4 md:py-2`}>
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}

        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className={`${SECONDARY_BUTTON_CLASS} px-2 py-3 md:hidden`}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          Menu
        </button>
      </div>

      {isOpen && (
        <div className={`${CARD_CLASS} p-2 md:hidden`}>
          <SidebarNavigation role={role} onNavigate={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}
