'use server';

import { randomUUID } from 'node:crypto';

import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { ForbiddenError, InsufficientStockError, InventoryItemNotFoundError, UserNotFoundError, ValidationError } from '@/lib/errors';
import { formatUserLabel } from '@/lib/format';
import { applyStockChange } from '@/lib/inventory-movements';
import { INVENTORY_ROLES } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { optionalNonNegativeNumber, optionalText, requirePositiveInteger, requireText } from '@/lib/validation';

const TRANSFER_VIEWS = ['/admin/inventario', '/admin/ventas', '/admin/dashboard', '/admin/reporte'];

export interface TransferPartner {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  /** RESELLER: es revendedor del usuario; SUPPLIER: es su abastecedor; USER: cualquier otro (solo el administrador). */
  relation: 'RESELLER' | 'SUPPLIER' | 'USER';
}

export interface TransferInput {
  toUserId: string;
  productId: string;
  quantity: number;
  /** Nota opcional que se suma al motivo del movimiento. */
  note?: string;
  /** Al transferir a un revendedor propio: el costo por unidad que paga desde ahora por este producto. */
  costPrice?: string | number | null;
}

export interface TransferResult {
  fromStock: number;
  toStock: number;
}

/**
 * Usuarios a los que se puede transferir stock: un tendero, a sus revendedores; un revendedor, a su tendero (para
 * devolver). El administrador puede transferir a cualquier tendero o revendedor activo.
 */
export async function getTransferPartners(): Promise<ActionResult<TransferPartner[]>> {
  return executeAction('transfers.getTransferPartners', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);
    const select = { id: true, name: true, email: true, role: true } as const;

    if (session.role === Role.ADMIN) {
      const users = await prisma.user.findMany({
        where: { isActive: true, id: { not: session.userId }, role: { in: [Role.STAFF, Role.RESELLER] } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select,
      });

      return users.map((user): TransferPartner => ({ ...user, relation: 'USER' }));
    }

    const [resellers, me] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true, supplierId: session.userId },
        orderBy: { createdAt: 'asc' },
        select,
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { supplier: { select: { ...select, isActive: true } } },
      }),
    ]);

    const supplier = me?.supplier?.isActive ? me.supplier : null;
    trace.addStep(`destinos-transferencia:${resellers.length + (supplier ? 1 : 0)}`);

    return [
      ...resellers.map((user): TransferPartner => ({ ...user, relation: 'RESELLER' })),
      ...(supplier
        ? [{ id: supplier.id, name: supplier.name, email: supplier.email, role: supplier.role, relation: 'SUPPLIER' } as const]
        : []),
    ];
  });
}

/**
 * Pasa unidades del inventario del usuario al de su revendedor (o de vuelta a su tendero). La salida exige stock
 * suficiente y deja dos movimientos vinculados, uno en cada inventario, en una sola transaccion.
 */
export async function transferStock(input: TransferInput): Promise<ActionResult<TransferResult>> {
  return executeAction('transfers.transferStock', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);

    const quantity = requirePositiveInteger(input.quantity, 'cantidad');
    const productId = requireText(input.productId, 'producto');
    const toUserId = requireText(input.toUserId, 'destinatario');
    const note = optionalText(input.note, 300);
    const costPrice = optionalNonNegativeNumber(input.costPrice, 'costo');
    trace.setBusinessId(productId);

    if (toUserId === session.userId) {
      throw new ValidationError('Elige a otro usuario: no puedes transferirte stock a ti mismo');
    }

    const [sender, recipient] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true, supplierId: true } }),
      prisma.user.findUnique({
        where: { id: toUserId },
        select: { id: true, name: true, email: true, role: true, isActive: true, supplierId: true },
      }),
    ]);

    if (!sender || !recipient) {
      throw new UserNotFoundError(!sender ? session.userId : toUserId);
    }

    if (!recipient.isActive || !INVENTORY_ROLES.includes(recipient.role)) {
      throw new ValidationError('El destinatario no puede recibir stock');
    }

    const isAdmin = session.role === Role.ADMIN;
    const isOwnReseller = recipient.supplierId === sender.id;
    const isOwnSupplier = sender.supplierId === recipient.id;

    if (!isAdmin && !isOwnReseller && !isOwnSupplier) {
      throw new ForbiddenError('Solo puedes transferir stock a tus revendedores o a tu tendero');
    }

    if (costPrice !== null && !(recipient.role === Role.RESELLER && (isAdmin || isOwnReseller))) {
      throw new ForbiddenError('Solo puedes fijar el costo de tus propios revendedores');
    }

    const result = await prisma.$transaction(async (transaction) => {
      const senderItem = await transaction.inventoryItem.findUnique({
        where: { ownerId_productId: { ownerId: sender.id, productId } },
        include: { product: { select: { name: true } } },
      });

      if (!senderItem) {
        throw new InventoryItemNotFoundError(productId);
      }

      const recipientItem = await transaction.inventoryItem.upsert({
        where: { ownerId_productId: { ownerId: recipient.id, productId } },
        update: costPrice === null ? {} : { costPrice },
        create: { ownerId: recipient.id, productId, costPrice },
      });

      const transferId = randomUUID();
      const suffix = note ? `: ${note}` : '';

      const fromStock = await applyStockChange(transaction, {
        inventoryItemId: senderItem.id,
        delta: -quantity,
        type: 'TRANSFER_OUT',
        reason: `Transferencia a ${formatUserLabel(recipient)}${suffix}`,
        userId: session.userId,
        transferId,
      });

      if (fromStock === null) {
        throw new InsufficientStockError(senderItem.product.name, senderItem.stock);
      }

      const toStock = await applyStockChange(transaction, {
        inventoryItemId: recipientItem.id,
        delta: quantity,
        type: 'TRANSFER_IN',
        reason: `Transferencia de ${formatUserLabel(sender)}${suffix}`,
        userId: session.userId,
        transferId,
      });

      return { fromStock, toStock: toStock ?? recipientItem.stock + quantity };
    });

    trace.addStep(`transferencia:${quantity}-unidades`);
    for (const route of TRANSFER_VIEWS) {
      revalidatePath(route);
    }

    return result;
  });
}
