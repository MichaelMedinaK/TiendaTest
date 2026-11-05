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

/** El precio del delivery siempre sube al siguiente multiplo de este valor (1 = a la unidad entera; ver calculateShippingPrice). */
export const SHIPPING_ROUNDING_STEP = 1;

/** Ancla del formulario de nueva venta; la usa el acceso rapido "Nueva venta". */
export const NEW_SALE_ANCHOR = 'nueva-venta';

/** Anclas de los formularios de alta de inventario y usuarios; las usa el acceso rapido "+ Nuevo ...". */
export const NEW_PRODUCT_ANCHOR = 'nuevo-producto';
export const NEW_MOVEMENT_ANCHOR = 'entrada-salida';
export const NEW_USER_ANCHOR = 'nuevo-usuario';

/** Los mensajes del chat dejan de verse y se borran pasado este tiempo. */
export const CHAT_MESSAGE_TTL_HOURS = 72;

/** Evento del navegador que avisa que se leyeron mensajes, para actualizar el contador del menu. */
export const CHAT_READ_EVENT = 'chat-read';
