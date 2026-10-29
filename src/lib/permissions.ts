// Import de solo tipos: este modulo tambien lo usa el middleware (Edge) y el navegador.
import type { Role } from '@prisma/client';

export const DELIVERIES_ROUTE = '/admin/entregas';

const ALL_ROUTES = [
  '/admin/dashboard',
  '/admin/ventas',
  '/admin/inventario',
  '/admin/reporte',
  DELIVERIES_ROUTE,
  '/admin/usuarios',
  '/admin/cuenta',
];

/** Rutas del panel permitidas por rol. ADMIN ve todo; TENDERO todo salvo usuarios; DOMICILIARIO solo entregas. */
export const ROLE_ROUTES: Record<Role, string[]> = {
  ADMIN: ALL_ROUTES,
  STAFF: ALL_ROUTES.filter((route) => route !== '/admin/usuarios'),
  COURIER: [DELIVERIES_ROUTE, '/admin/cuenta'],
};

export const ROLE_HOME_ROUTE: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  STAFF: '/admin/dashboard',
  COURIER: DELIVERIES_ROUTE,
};

export function canAccessRoute(role: Role, pathname: string): boolean {
  return ROLE_ROUTES[role].some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
