import 'server-only';

import type { SessionPayload } from './jwt';
import { assertOwnsInventory } from './inventory-scope';
import { hasCourierProfile } from './permissions';

/** El administrador y quien tenga perfil de domiciliario atienden cualquier pedido; los demas, solo los suyos. */
export function canHandleAnyOrder(session: SessionPayload): boolean {
  return session.role === 'ADMIN' || hasCourierProfile(session);
}

export function assertCanHandleOrder(session: SessionPayload, sellerId: string): void {
  if (!canHandleAnyOrder(session)) {
    assertOwnsInventory(session, sellerId);
  }
}
