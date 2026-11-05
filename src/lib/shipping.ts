import { SHIPPING_ROUNDING_STEP } from './constants';

export interface ShippingRate {
  /** Tarifa por kilometro. */
  ratePerKm: number;
  /** Precio minimo del envio. */
  minPrice: number;
}

/**
 * Precio del delivery: kilometros x tarifa, redondeado hacia arriba (7.99 -> 8) y nunca por debajo del
 * minimo. Sin kilometros (recogida o distancia sin calcular) no se cobra envio. La tarifa llega desde el
 * servidor (readShippingRate); el formulario la recibe como prop para mostrar el mismo total.
 */
export function calculateShippingPrice(distanceKm: number, { ratePerKm, minPrice }: ShippingRate): number {
  if (!(distanceKm > 0)) {
    return 0;
  }

  const rawPrice = Math.round(distanceKm * ratePerKm * 100) / 100;
  const roundedPrice = Math.ceil(rawPrice / SHIPPING_ROUNDING_STEP) * SHIPPING_ROUNDING_STEP;

  return Math.max(roundedPrice, minPrice);
}
