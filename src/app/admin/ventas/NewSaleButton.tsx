'use client';

import { Plus } from 'lucide-react';

import { requestOpenFormPanel } from '@/components/FormPanel';
import { PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { NEW_SALE_ANCHOR } from '@/lib/constants';

/** Boton de la cabecera: abre el formulario de nueva venta (NewSalePanel) y lleva la vista hasta el. */
export function NewSaleButton() {
  return (
    <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => requestOpenFormPanel(NEW_SALE_ANCHOR)}>
      <Plus className="h-4 w-4" />
      Nueva venta
    </button>
  );
}
