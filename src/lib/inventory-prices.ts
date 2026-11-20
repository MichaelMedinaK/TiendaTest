/** Precios efectivos de un inventario: el propio del dueno si lo tiene y, si no, el del catalogo. */

interface CatalogPrices {
  costPrice: number;
  price: number;
}

/**
 * Lo que le cuesta el producto al dueno. Un revendedor paga el precio que le fijo su tendero; mientras no tenga uno
 * se toma el precio de venta del catalogo (asi nunca se le expone el costo real). Los demas usan el costo del catalogo.
 */
export function effectiveCostPrice(
  item: { costPrice: number | null },
  product: CatalogPrices,
  ownerRole: string,
): number {
  if (item.costPrice !== null) {
    return item.costPrice;
  }

  return ownerRole === 'RESELLER' ? product.price : product.costPrice;
}

/** Precio al que vende el dueno: el que fijo en su inventario o, si no, el del catalogo. */
export function effectiveSalePrice(item: { salePrice: number | null }, product: Pick<CatalogPrices, 'price'>): number {
  return item.salePrice ?? product.price;
}
