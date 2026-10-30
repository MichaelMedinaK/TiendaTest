import { DELIVERY_RATE_PER_KM, SHIPPING_ROUNDING_STEP } from './constants';

/**
 * Precio del delivery: kilometros x tarifa, redondeado a miles. Si el resto es 500 o menos baja
 * (13500 -> 13000) y si es mayor sube (13600 -> 14000). Lo usan el formulario y el servidor.
 */
export function calculateShippingPrice(distanceKm: number): number {
  const rawPrice = Math.round(distanceKm * DELIVERY_RATE_PER_KM * 100) / 100;
  const remainder = rawPrice % SHIPPING_ROUNDING_STEP;
  const roundedDown = rawPrice - remainder;

  return remainder > SHIPPING_ROUNDING_STEP / 2 ? roundedDown + SHIPPING_ROUNDING_STEP : roundedDown;
}
