'use client';

import { TableProperties } from 'lucide-react';
import { useState } from 'react';

import type { InventoryProduct } from '@/actions/products';
import { SECONDARY_BUTTON_CLASS } from '@/components/ui/styles';

import { InventorySheet } from './InventorySheet';
import { InventoryTable } from './InventoryTable';

/** Lista del inventario; el administrador puede pasarla a modo planilla para editar todas las celdas. */
export function InventoryView({
  ownerId,
  products,
  canEditAll,
  isResellerInventory,
}: {
  ownerId: string;
  products: InventoryProduct[];
  /** Solo el administrador principal puede editar todo el inventario a la vez. */
  canEditAll: boolean;
  isResellerInventory: boolean;
}) {
  const [isEditingAll, setIsEditingAll] = useState(false);

  if (isEditingAll) {
    return (
      <InventorySheet
        // Al cambiar de inventario la planilla se reinicia con los datos del nuevo.
        key={ownerId}
        ownerId={ownerId}
        products={products}
        canEditCost={isResellerInventory}
        onClose={() => setIsEditingAll(false)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {canEditAll && products.length > 0 && (
        <div className="flex justify-end">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setIsEditingAll(true)}>
            <TableProperties className="h-4 w-4" />
            Cambiar todo el inventario
          </button>
        </div>
      )}
      <InventoryTable products={products} />
    </div>
  );
}
