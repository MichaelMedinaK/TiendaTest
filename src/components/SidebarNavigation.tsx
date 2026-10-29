'use client';

import { FileText, LayoutDashboard, Package, ShoppingCart, UserCog, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { Role } from '@prisma/client';

interface NavigationItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  allowedRoles?: Role[];
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/ventas', label: 'Ventas', icon: ShoppingCart },
  { href: '/admin/inventario', label: 'Inventario', icon: Package },
  { href: '/admin/reporte', label: 'Reporte', icon: FileText },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users, allowedRoles: ['ADMIN'] },
  { href: '/admin/cuenta', label: 'Mi cuenta', icon: UserCog },
];

export function SidebarNavigation({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleItems = NAVIGATION_ITEMS.filter((item) => !item.allowedRoles || item.allowedRoles.includes(role));

  return (
    <nav className="flex flex-col gap-1">
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
