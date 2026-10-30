// Import de solo tipos: este modulo tambien lo usa el middleware (Edge) y el navegador.
import type { Role } from '@prisma/client';

export const DELIVERIES_ROUTE = '/admin/entregas';

const ALL_ROUTES = [
  '/admin/dashboard',
  '/admin/ventas',
  '/admin/inventario',
  '/admin/catalogo',
  '/admin/reporte',
  '/admin/cotizar-envio',
  DELIVERIES_ROUTE,
  '/admin/usuarios',
  '/admin/cuenta',
];

const ADMIN_ONLY_ROUTES = ['/admin/usuarios', '/admin/catalogo'];

/** Rutas del panel permitidas por rol. ADMIN ve todo; TENDERO y REVENDEDOR todo salvo usuarios y catalogo; DOMICILIARIO solo entregas. */
export const ROLE_ROUTES: Record<Role, string[]> = {
  ADMIN: ALL_ROUTES,
  STAFF: ALL_ROUTES.filter((route) => !ADMIN_ONLY_ROUTES.includes(route)),
  RESELLER: ALL_ROUTES.filter((route) => !ADMIN_ONLY_ROUTES.includes(route)),
  COURIER: [DELIVERIES_ROUTE, '/admin/cuenta'],
};

export const ROLE_HOME_ROUTE: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  STAFF: '/admin/dashboard',
  RESELLER: '/admin/dashboard',
  COURIER: DELIVERIES_ROUTE,
};

/** Roles con inventario y ventas propias. */
export const INVENTORY_ROLES: Role[] = ['ADMIN', 'STAFF', 'RESELLER'];

/** Atiende cualquier domicilio: el domiciliario, o quien tenga el perfil de domiciliario ademas de su rol. */
export function hasCourierProfile(user: { role: Role; isCourier?: boolean }): boolean {
  return user.role === 'COURIER' || user.isCourier === true;
}

export function canAccessRoute(role: Role, pathname: string): boolean {
  return ROLE_ROUTES[role].some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
