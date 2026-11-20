'use client';

import type { ResellerOption } from '@/actions/pricing';
import type { CatalogOption, InventoryProduct, ManualMovementView } from '@/actions/products';
import type { TransferPartner } from '@/actions/transfers';
import { FormPanelButton, useFormPanel } from '@/components/FormPanel';
import { NEW_MOVEMENT_ANCHOR, NEW_PRODUCT_ANCHOR, NEW_TRANSFER_ANCHOR, RESELLER_PRICES_ANCHOR } from '@/lib/constants';

import { AddToInventoryForm } from './AddToInventoryForm';
import { ResellerPricesPanel } from './ResellerPricesPanel';
import { StockMovementsPanel } from './StockMovementsPanel';
import { TransferPanel } from './TransferPanel';

interface InventoryActionsProps {
  ownerId: string;
  /** Productos del catalogo que todavia no estan en este inventario. */
  catalog: CatalogOption[];
  products: InventoryProduct[];
  movements: ManualMovementView[];
  /** A quien puede transferir stock el usuario (vacio si mira el inventario de otro). */
  partners: TransferPartner[];
  /** Revendedores cuyos costos puede fijar (vacio si mira el inventario de otro). */
  resellers: ResellerOption[];
}

/** Botones de la parte alta del inventario: agregar un producto, entradas y salidas, transferencias y costos de revendedores. */
export function InventoryActions({ ownerId, catalog, products, movements, partners, resellers }: InventoryActionsProps) {
  const addPanel = useFormPanel(NEW_PRODUCT_ANCHOR);
  const movementPanel = useFormPanel(NEW_MOVEMENT_ANCHOR);
  const transferPanel = useFormPanel(NEW_TRANSFER_ANCHOR);
  const pricesPanel = useFormPanel(RESELLER_PRICES_ANCHOR);

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
        {partners.length > 0 && (
          <FormPanelButton
            isOpen={transferPanel.isOpen}
            label="Transferir stock"
            openLabel="Cerrar transferencia"
            onToggle={transferPanel.toggle}
          />
        )}
        {resellers.length > 0 && (
          <FormPanelButton
            isOpen={pricesPanel.isOpen}
            label="Costos de revendedores"
            openLabel="Cerrar costos"
            onToggle={pricesPanel.toggle}
          />
        )}
      </div>

      <div id={NEW_PRODUCT_ANCHOR} className="scroll-mt-36 md:scroll-mt-6">
        {addPanel.isOpen && <AddToInventoryForm ownerId={ownerId} catalog={catalog} onDone={addPanel.close} />}
      </div>

      <div id={NEW_MOVEMENT_ANCHOR} className="scroll-mt-36 md:scroll-mt-6">
        {movementPanel.isOpen && <StockMovementsPanel key={ownerId} products={products} movements={movements} />}
      </div>

      <div id={NEW_TRANSFER_ANCHOR} className="scroll-mt-36 md:scroll-mt-6">
        {transferPanel.isOpen && <TransferPanel products={products} partners={partners} />}
      </div>

      <div id={RESELLER_PRICES_ANCHOR} className="scroll-mt-36 md:scroll-mt-6">
        {pricesPanel.isOpen && <ResellerPricesPanel resellers={resellers} />}
      </div>
    </div>
  );
}
