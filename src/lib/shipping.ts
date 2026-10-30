import { DELIVERY_RATE_PER_KM, SHIPPING_ROUNDING_STEP } from './constants';

/** Precio del delivery: kilometros x tarifa, siempre redondeado hacia arriba (7.99 -> 8). Lo usan el formulario y el servidor. */
export function calculateShippingPrice(distanceKm: number): number {
  const rawPrice = Math.round(distanceKm * DELIVERY_RATE_PER_KM * 100) / 100;

  return Math.ceil(rawPrice / SHIPPING_ROUNDING_STEP) * SHIPPING_ROUNDING_STEP;
}
