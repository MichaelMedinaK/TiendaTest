import 'server-only';

import type { ShippingRate } from './shipping';

const DEFAULT_RATE_PER_KM = 1.7;
const DEFAULT_MIN_PRICE = 8;

/**
 * Tarifa del delivery configurada con DELIVERY_RATE_PER_KM y DELIVERY_MIN_PRICE. Solo la lee el servidor:
 * las paginas se la pasan al formulario de venta para que calcule el mismo total mientras se escribe.
 */
export function readShippingRate(): ShippingRate {
  return {
    ratePerKm: Number(process.env.DELIVERY_RATE_PER_KM) || DEFAULT_RATE_PER_KM,
    minPrice: Number(process.env.DELIVERY_MIN_PRICE) || DEFAULT_MIN_PRICE,
  };
}
