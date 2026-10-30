'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { NEW_SALE_ANCHOR } from '@/lib/constants';

const SALES_ROUTE = '/admin/ventas';
const NEW_SALE_HREF = `${SALES_ROUTE}#${NEW_SALE_ANCHOR}`;

/** Acceso rapido para registrar una venta: boton flotante en celular y boton del menu en escritorio. */
export function NewSaleButton({ variant }: { variant: 'floating' | 'sidebar' }) {
  const pathname = usePathname();

  if (variant === 'floating') {
    // En la propia pagina de ventas el formulario ya esta a la vista y el boton taparia sus acciones.
    if (pathname.startsWith(SALES_ROUTE)) {
      return null;
    }

    return (
      <Link
        href={NEW_SALE_HREF}
        aria-label="Nueva venta"
        className={`${PRIMARY_BUTTON_CLASS} fixed bottom-4 right-4 z-20 gap-1.5 rounded-full px-5 py-3 shadow-lg md:hidden print:hidden`}
      >
        <Plus className="h-5 w-5" />
        Nueva venta
      </Link>
    );
  }

  return (
    <Link href={NEW_SALE_HREF} className={`${PRIMARY_BUTTON_CLASS} mb-4 w-full`}>
      <Plus className="h-4 w-4" />
      Nueva venta
    </Link>
  );
}
