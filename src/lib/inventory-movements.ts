import 'server-only';

import type { MovementType, Prisma } from '@prisma/client';

export interface StockChange {
  inventoryItemId: string;
  /** Con signo: positivo suma al stock, negativo resta. */
  delta: number;
  type: MovementType;
  reason: string;
  userId: string;
  orderId?: string;
}

/**
 * Cambia el stock de un item y deja el movimiento con el stock resultante, todo en la misma transaccion.
 * Una resta solo se aplica si alcanza el stock (el filtro garantiza el descuento atomico con ventas simultaneas).
 * Devuelve el stock resultante, o null si no alcanzaba.
 */
export async function applyStockChange(
  transaction: Prisma.TransactionClient,
  change: StockChange,
): Promise<number | null> {
  const { inventoryItemId, delta } = change;

  const update = await transaction.inventoryItem.updateMany({
    where: delta < 0 ? { id: inventoryItemId, stock: { gte: -delta } } : { id: inventoryItemId },
    data: { stock: { increment: delta } },
  });

  if (update.count === 0) {
    return null;
  }

  const { stock } = await transaction.inventoryItem.findUniqueOrThrow({
    where: { id: inventoryItemId },
    select: { stock: true },
  });

  await transaction.inventoryMovement.create({
    data: {
      inventoryItemId,
      type: change.type,
      quantity: delta,
      stockAfter: stock,
      reason: change.reason,
      userId: change.userId,
      orderId: change.orderId,
    },
  });

  return stock;
}
