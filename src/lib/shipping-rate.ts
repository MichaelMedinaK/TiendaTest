import 'server-only';

import { readSettings } from './settings';
import type { ShippingRate } from './shipping';

/**
 * Tarifa del delivery vigente: la del panel de parametros o, si no se configuro, DELIVERY_RATE_PER_KM y
 * DELIVERY_MIN_PRICE. Solo la lee el servidor: las paginas se la pasan al formulario de venta para que calcule
 * el mismo total mientras se escribe.
 */
export async function getShippingRate(): Promise<ShippingRate> {
  const settings = await readSettings();

  return {
    ratePerKm: settings.DELIVERY_RATE_PER_KM.value,
    minPrice: settings.DELIVERY_MIN_PRICE.value,
  };
}
