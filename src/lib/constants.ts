// Import de solo tipos: este modulo tambien se carga en el navegador y el middleware.
import type { DeliveryStatus } from '@prisma/client';

/** Umbral de stock bajo usado por el dashboard y el inventario. */
export const LOW_STOCK_THRESHOLD = 5;

/** Estados de envio en los que la venta sigue en curso (aun no se entrega ni se cancela). */
export const OPEN_DELIVERY_STATUSES: DeliveryStatus[] = ['PENDING', 'PACKED', 'IN_TRANSIT'];

export const LOGIN_ROUTE = '/login';
export const DASHBOARD_ROUTE = '/admin/dashboard';

/** En produccion los mensajes de error no revelan detalles internos (usuarios, variables, base de datos). */
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Tarifa del delivery por kilometro; el precio del envio es kilometros x tarifa. Configurable con NEXT_PUBLIC_DELIVERY_RATE_PER_KM. */
export const DELIVERY_RATE_PER_KM = Number(process.env.NEXT_PUBLIC_DELIVERY_RATE_PER_KM) || 1700;

/** El precio del delivery se redondea a multiplos de este valor (ver calculateShippingPrice). */
export const SHIPPING_ROUNDING_STEP = 1000;

/** Ancla del formulario de nueva venta; la usa el acceso rapido "Nueva venta". */
export const NEW_SALE_ANCHOR = 'nueva-venta';
