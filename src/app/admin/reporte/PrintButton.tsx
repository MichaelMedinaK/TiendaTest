'use client';

import { Printer } from 'lucide-react';

import { PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';

/** Abre el dialogo de impresion del navegador; ahi se elige "Guardar como PDF". */
export function PrintButton() {
  return (
    <button type="button" className={`${PRIMARY_BUTTON_CLASS} print:hidden`} onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      Imprimir / Guardar PDF
    </button>
  );
}
