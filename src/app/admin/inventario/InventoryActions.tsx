'use client';

import type { CatalogOption, InventoryProduct, ManualMovementView } from '@/actions/products';
import { FormPanelButton, useFormPanel } from '@/components/FormPanel';
import { NEW_MOVEMENT_ANCHOR, NEW_PRODUCT_ANCHOR } from '@/lib/constants';

import { AddToInventoryForm } from './AddToInventoryForm';
import { StockMovementsPanel } from './StockMovementsPanel';

interface InventoryActionsProps {
  ownerId: string;
  /** Productos del catalogo que todavia no estan en este inventario. */
  catalog: CatalogOption[];
  products: InventoryProduct[];
  movements: ManualMovementView[];
}

/** Botones de la parte alta del inventario: agregar un producto y registrar entradas o salidas de stock. */
export function InventoryActions({ ownerId, catalog, products, movements }: InventoryActionsProps) {
  const addPanel = useFormPanel(NEW_PRODUCT_ANCHOR);
  const movementPanel = useFormPanel(NEW_MOVEMENT_ANCHOR);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <FormPanelButton
          isOpen={addPanel.isOpen}
          label="Agregar al inventario"
          openLabel="Cerrar agregar"
          onToggle={addPanel.toggle}
        />
        <FormPanelButton
          isOpen={movementPanel.isOpen}
          label="Entrada / salida"
          openLabel="Cerrar entrada / salida"
          onToggle={movementPanel.toggle}
        />
      </div>

      <div id={NEW_PRODUCT_ANCHOR} className="scroll-mt-36 md:scroll-mt-6">
        {addPanel.isOpen && <AddToInventoryForm ownerId={ownerId} catalog={catalog} onDone={addPanel.close} />}
      </div>

      <div id={NEW_MOVEMENT_ANCHOR} className="scroll-mt-36 md:scroll-mt-6">
        {movementPanel.isOpen && <StockMovementsPanel key={ownerId} products={products} movements={movements} />}
      </div>
    </div>
  );
}
