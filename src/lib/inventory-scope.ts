import 'server-only';

import type { SessionPayload } from './jwt';
import { ForbiddenError, ValidationError } from './errors';
import { prisma } from './prisma';

/** Valor de filtro que significa "los inventarios de todos los usuarios" (solo lo respeta el administrador). */
export const ALL_OWNERS = 'ALL';

/**
 * Filtro por dueno del inventario. Solo el administrador puede mirar inventarios ajenos; los demas roles
 * quedan siempre limitados al propio, sin importar lo que pidan. Sin pedido, `defaultToAll` decide si el
 * administrador ve todo o solo lo suyo.
 */
export function resolveOwnerFilter(
  session: SessionPayload,
  requested: string | undefined,
  defaultToAll: boolean,
): { ownerId?: string } {
  if (session.role !== 'ADMIN') {
    return { ownerId: session.userId };
  }

  if (requested === ALL_OWNERS || (!requested && defaultToAll)) {
    return {};
  }

  return { ownerId: requested || session.userId };
}

/** Dueno con el que se crea un producto o una venta: el administrador puede elegir a otro usuario activo. */
export async function resolveActingOwnerId(session: SessionPayload, requestedOwnerId?: string): Promise<string> {
  if (session.role !== 'ADMIN' || !requestedOwnerId || requestedOwnerId === session.userId) {
    return session.userId;
  }

  const owner = await prisma.user.findUnique({
    where: { id: requestedOwnerId },
    select: { isActive: true, role: true },
  });

  if (!owner || !owner.isActive || owner.role === 'COURIER') {
    throw new ValidationError('El usuario elegido no puede tener inventario');
  }

  return requestedOwnerId;
}

export function assertOwnsInventory(session: SessionPayload, ownerId: string): void {
  if (session.role !== 'ADMIN' && session.userId !== ownerId) {
    throw new ForbiddenError('No tienes acceso al inventario de otro usuario');
  }
}
