'use server';

import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { ForbiddenError, InsufficientStockError, InventoryItemNotFoundError, UserNotFoundError, ValidationError } from '@/lib/errors';
import { applyStockChange } from '@/lib/inventory-movements';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import {
  optionalNonNegativeNumber,
  requireNonNegativeInteger,
  requirePositiveNumber,
  requireText,
} from '@/lib/validation';

const SHEET_VIEWS = ['/admin/inventario', '/admin/ventas', '/admin/dashboard', '/admin/entregas', '/admin/reporte'];
const MAX_CHANGES = 500;

export interface InventorySheetChange {
  inventoryItemId: string;
  /** Stock que vio quien edita y el que quiere dejar; si el stock real cambio mientras tanto, se rechaza. */
  stock?: { from: number; to: number };
  /** Precio de venta propio; vacio vuelve al precio del catalogo. */
  salePrice?: string | number | null;
  /** Costo propio (solo revendedores); vacio lo deja sin costo propio. */
  costPrice?: string | number | null;
}

export interface InventorySheetResult {
  updatedCount: number;
  stockChangesCount: number;
}

const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && !value.trim());

/**
 * Edicion masiva del inventario de un usuario (estilo planilla): solo el administrador. Todo se guarda en una unica
 * transaccion; si algo falla no se aplica nada. El stock cambia como entrada o salida con la descripcion indicada, para
 * que el historial siga siendo la unica fuente de cambios de stock.
 */
export async function updateInventorySheet(
  ownerId: string,
  changes: InventorySheetChange[],
  reason: string,
): Promise<ActionResult<InventorySheetResult>> {
  return executeAction('products.updateInventorySheet', async (trace) => {
    const session = await requireRole('ADMIN');
    trace.setBusinessId(ownerId);

    if (!Array.isArray(changes) || changes.length === 0) {
      throw new ValidationError('No hay cambios para guardar');
    }

    if (changes.length > MAX_CHANGES) {
      throw new ValidationError(`Se pueden guardar hasta ${MAX_CHANGES} productos a la vez`);
    }

    const ids = changes.map((change) => change.inventoryItemId);

    if (new Set(ids).size !== ids.length) {
      throw new ValidationError('Hay productos repetidos en los cambios');
    }

    const hasStockChanges = changes.some((change) => change.stock);
    const movementReason = hasStockChanges ? `Ajuste de inventario: ${requireText(reason, 'descripcion', 450)}` : '';

    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { role: true } });

    if (!owner) {
      throw new UserNotFoundError(ownerId);
    }

    const result = await prisma.$transaction(
      async (transaction) => {
        const items = await transaction.inventoryItem.findMany({
          where: { id: { in: ids } },
          select: { id: true, ownerId: true, stock: true, product: { select: { name: true } } },
        });
        const itemsById = new Map(items.map((item) => [item.id, item]));
        let stockChangesCount = 0;

        for (const change of changes) {
          const item = itemsById.get(change.inventoryItemId);

          if (!item) {
            throw new InventoryItemNotFoundError(change.inventoryItemId);
          }

          if (item.ownerId !== ownerId) {
            throw new ForbiddenError('Los productos no pertenecen al inventario indicado');
          }

          const data: { salePrice?: number | null; costPrice?: number | null } = {};

          if ('salePrice' in change) {
            data.salePrice = isBlank(change.salePrice)
              ? null
              : requirePositiveNumber(change.salePrice, `precio de venta de ${item.product.name}`);
          }

          if ('costPrice' in change) {
            if (owner.role !== 'RESELLER') {
              throw new ValidationError('El precio real solo se edita aqui en inventarios de revendedores; el resto se cambia en Catalogo');
            }

            data.costPrice = optionalNonNegativeNumber(change.costPrice, `precio real de ${item.product.name}`);
          }

          if (Object.keys(data).length > 0) {
            await transaction.inventoryItem.update({ where: { id: item.id }, data });
          }

          if (change.stock) {
            const from = Number(change.stock.from);
            const to = requireNonNegativeInteger(change.stock.to, `stock de ${item.product.name}`);

            if (item.stock !== from) {
              throw new ValidationError(
                `El stock de "${item.product.name}" cambio mientras editabas (ahora ${item.stock}). Recarga la pagina y vuelve a intentarlo`,
              );
            }

            const delta = to - from;

            if (delta !== 0) {
              const stock = await applyStockChange(transaction, {
                inventoryItemId: item.id,
                delta,
                type: delta > 0 ? 'ENTRY' : 'EXIT',
                reason: movementReason,
                userId: session.userId,
              });

              if (stock === null) {
                throw new InsufficientStockError(item.product.name, item.stock);
              }

              stockChangesCount += 1;
            }
          }
        }

        return { updatedCount: changes.length, stockChangesCount };
      },
      { timeout: 30_000 },
    );

    trace.addStep(`planilla-guardada:${result.updatedCount}-productos:${result.stockChangesCount}-stock`);
    SHEET_VIEWS.forEach((path) => revalidatePath(path));

    return result;
  });
}
