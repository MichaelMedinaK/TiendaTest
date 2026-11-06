'use client';

import { Boxes, LayoutList, MapPin, MessageCircle, Package, ShoppingCart, Truck, UserCog, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { Role } from '@prisma/client';

import { useUnreadChatCount } from '@/components/useUnreadChatCount';
import { CHAT_ROUTE, canAccessRoute } from '@/lib/permissions';

interface NavigationItem {
  href: string;
  label: string;
  icon: typeof ShoppingCart;
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: '/admin/dashboard', label: 'Inicio', icon: LayoutList },
  { href: '/admin/ventas', label: 'Ventas', icon: ShoppingCart },
  { href: '/admin/entregas', label: 'Entregas', icon: Truck },
  { href: CHAT_ROUTE, label: 'Chat', icon: MessageCircle },
  { href: '/admin/cotizar-envio', label: 'Cotizar envio', icon: MapPin },
  { href: '/admin/inventario', label: 'Inventario', icon: Package },
  { href: '/admin/catalogo', label: 'Catalogo', icon: Boxes },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { href: '/admin/cuenta', label: 'Mi cuenta', icon: UserCog },
];

interface SidebarNavigationProps {
  role: Role;
  /** `menu` es la version oscura apilada del desplegable que se usa en celulares. */
  variant?: 'sidebar' | 'menu';
  /** Se ejecuta al elegir una opcion (p. ej. para cerrar el desplegable). */
  onNavigate?: () => void;
}

const LINK_STYLES = {
  sidebar: {
    base: 'gap-3 py-2',
    active: 'bg-gradient-to-r from-brand-600 to-pink-500 text-white shadow-sm',
    inactive: 'text-slate-600 hover:bg-pink-100/70 hover:text-pink-700',
    inactiveIcon: 'text-brand-500',
  },
  menu: {
    base: 'gap-3 py-3',
    active: 'bg-white/95 text-blue-900',
    inactive: 'text-white hover:bg-white/15',
    inactiveIcon: 'text-white/80',
  },
};

export function SidebarNavigation({ role, variant = 'sidebar', onNavigate }: SidebarNavigationProps) {
  const pathname = usePathname();
  const visibleItems = NAVIGATION_ITEMS.filter((item) => canAccessRoute(role, item.href));
  const styles = LINK_STYLES[variant];
  const unreadChatCount = useUnreadChatCount(canAccessRoute(role, CHAT_ROUTE));

  return (
    <nav className="flex flex-col gap-1">
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center rounded-lg px-3 text-sm font-medium transition ${styles.base} ${
              isActive ? styles.active : styles.inactive
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? '' : styles.inactiveIcon}`} />
            {label}
            {href === CHAT_ROUTE && unreadChatCount > 0 && (
              <span className="ml-auto rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                {unreadChatCount > 99 ? '99+' : unreadChatCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
