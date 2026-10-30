'use client';

import type { InventoryOwner, InventoryProduct } from '@/actions/products';
import { FormPanel } from '@/components/FormPanel';
import { NEW_SALE_ANCHOR } from '@/lib/constants';

import { OrderForm } from './OrderForm';

interface NewSalePanelProps {
  products: InventoryProduct[];
  sellers: InventoryOwner[];
  currentUserId: string;
}

/** Formulario de nueva venta oculto hasta pulsar "Nueva venta". */
export function NewSalePanel({ products, sellers, currentUserId }: NewSalePanelProps) {
  return (
    <FormPanel anchorId={NEW_SALE_ANCHOR} label="Nueva venta">
      {(close) => <OrderForm products={products} sellers={sellers} currentUserId={currentUserId} onFinished={close} />}
    </FormPanel>
  );
}
