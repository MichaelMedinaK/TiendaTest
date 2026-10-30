'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { type MouseEvent } from 'react';

import { requestOpenFormPanel } from '@/components/FormPanel';
import { PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { NEW_PRODUCT_ANCHOR, NEW_SALE_ANCHOR, NEW_USER_ANCHOR } from '@/lib/constants';

const SALES_ROUTE = '/admin/ventas';

/** Acceso rapido de cada seccion: abre el formulario de alta correspondiente. El inicio muestra las ventas, asi que ofrece "Nueva venta". */
const QUICK_ADD_ACTIONS = [
  { route: SALES_ROUTE, label: 'Nueva venta', target: SALES_ROUTE, anchor: NEW_SALE_ANCHOR },
  { route: '/admin/dashboard', label: 'Nueva venta', target: SALES_ROUTE, anchor: NEW_SALE_ANCHOR },
  { route: '/admin/inventario', label: 'Agregar al inventario', target: '/admin/inventario', anchor: NEW_PRODUCT_ANCHOR },
  { route: '/admin/catalogo', label: 'Nuevo producto', target: '/admin/catalogo', anchor: NEW_PRODUCT_ANCHOR },
  { route: '/admin/usuarios', label: 'Nuevo usuario', target: '/admin/usuarios', anchor: NEW_USER_ANCHOR },
];

/** Boton "+ Nuevo ..." segun la seccion actual: flotante en celular y en el menu lateral en escritorio. */
export function QuickAddButton({ variant }: { variant: 'floating' | 'sidebar' }) {
  const pathname = usePathname();
  const action = QUICK_ADD_ACTIONS.find(({ route }) => pathname.startsWith(route));

  if (!action) {
    return null;
  }

  const href = `${action.target}#${action.anchor}`;
  // Ya en la pagina del formulario solo se abre; desde otra pagina se navega y el formulario se abre al cargar.
  const handleClick = (event: MouseEvent) => {
    if (pathname.startsWith(action.target)) {
      event.preventDefault();
      requestOpenFormPanel(action.anchor);
    }
  };

  if (variant === 'floating') {
    return (
      <Link
        href={href}
        onClick={handleClick}
        aria-label={action.label}
        className={`${PRIMARY_BUTTON_CLASS} fixed bottom-4 right-4 z-20 gap-1.5 rounded-full px-5 py-3 shadow-lg md:hidden print:hidden`}
      >
        <Plus className="h-5 w-5" />
        {action.label}
      </Link>
    );
  }

  return (
    <Link href={href} onClick={handleClick} className={`${PRIMARY_BUTTON_CLASS} mb-4 w-full`}>
      <Plus className="h-4 w-4" />
      {action.label}
    </Link>
  );
}
