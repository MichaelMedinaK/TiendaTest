'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { type MouseEvent } from 'react';

import { requestOpenFormPanel } from '@/components/FormPanel';
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

/** Boton flotante "+ Nuevo ..." segun la seccion actual: siempre a mano, sin volver al inicio de la pagina. */
export function QuickAddButton() {
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

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-label={action.label}
      title={action.label}
      className="fixed bottom-5 right-5 z-40 inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-full bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-black/30 transition hover:bg-indigo-500 md:h-auto md:w-auto md:px-3.5 md:py-2 print:hidden"
    >
      <Plus className="h-4 w-4" />
      <span className="hidden md:inline">{action.label}</span>
    </Link>
  );
}
