'use client';

import type { InventoryOwner, InventoryProduct } from '@/actions/products';
import { FormPanel } from '@/components/FormPanel';
import { NEW_SALE_ANCHOR } from '@/lib/constants';
import type { ShippingRate } from '@/lib/shipping';

import { OrderForm } from './OrderForm';

interface NewSalePanelProps {
  products: InventoryProduct[];
  shippingRate: ShippingRate;
  sellers: InventoryOwner[];
  currentUserId: string;
}

/** Formulario de nueva venta oculto hasta pulsar "Nueva venta". */
export function NewSalePanel({ products, shippingRate, sellers, currentUserId }: NewSalePanelProps) {
  return (
    <FormPanel anchorId={NEW_SALE_ANCHOR} label="Nueva venta">
      {(close) => (
        <OrderForm
          products={products}
          shippingRate={shippingRate}
          sellers={sellers}
          currentUserId={currentUserId}
          onFinished={close}
        />
      )}
    </FormPanel>
  );
}
