'use server';

import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { ForbiddenError, InventoryItemNotFoundError, ProductNotFoundError, UserNotFoundError } from '@/lib/errors';
import { assertOwnsInventory } from '@/lib/inventory-scope';
import { effectiveSalePrice } from '@/lib/inventory-prices';
import { INVENTORY_ROLES } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { optionalNonNegativeNumber, requirePositiveNumber } from '@/lib/validation';

// Los precios aparecen en el inventario, al vender, en las entregas y en el reporte.
const PRICE_VIEWS = ['/admin/inventario', '/admin/ventas', '/admin/dashboard', '/admin/entregas', '/admin/reporte'];

export interface ResellerOption {
  id: string;
  name: string | null;
  email: string;
}

export interface ResellerPriceRow {
  productId: string;
  name: string;
  sku: string | null;
  /** Stock actual del revendedor (0 si todavia no tiene el producto). */
  resellerStock: number;
  /** Costo fijado para el revendedor; null si no tiene uno (paga el precio de venta del catalogo). */
  costPrice: number | null;
  /** Precio de venta actual del abastecedor, como referencia. */
  referencePrice: number;
}

export interface ResellerPriceList {
  reseller: ResellerOption;
  rows: ResellerPriceRow[];
}

function revalidatePriceViews(): void {
  for (const route of PRICE_VIEWS) {
    revalidatePath(route);
  }
}

/** Revendedores cuyos costos puede fijar el usuario: los suyos (el administrador, todos los activos). */
export async function getMyResellers(): Promise<ActionResult<ResellerOption[]>> {
  return executeAction('pricing.getMyResellers', async () => {
    const session = await requireRole(...INVENTORY_ROLES);

    if (session.role !== Role.ADMIN && session.role !== Role.STAFF) {
      return [];
    }

    return prisma.user.findMany({
      where: {
        isActive: true,
        role: Role.RESELLER,
        ...(session.role === Role.ADMIN ? {} : { supplierId: session.userId }),
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true },
    });
  });
}

/** Solo el abastecedor del revendedor (o el administrador) puede fijar sus costos. */
async function requireSupplierAccess(session: { role: Role; userId: string }, resellerId: string) {
  const reseller = await prisma.user.findUnique({
    where: { id: resellerId },
    select: { id: true, name: true, email: true, role: true, isActive: true, supplierId: true },
  });

  if (!reseller) {
    throw new UserNotFoundError(resellerId);
  }

  if (reseller.role !== Role.RESELLER) {
    throw new ForbiddenError('Solo se fijan costos a revendedores');
  }

  if (session.role !== Role.ADMIN && reseller.supplierId !== session.userId) {
    throw new ForbiddenError('Solo el tendero que abastece al revendedor puede fijar sus costos');
  }

  return reseller;
}

/** Productos del inventario del abastecedor con el costo que paga el revendedor por cada uno. */
export async function getResellerPriceList(resellerId: string): Promise<ActionResult<ResellerPriceList>> {
  return executeAction('pricing.getResellerPriceList', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);
    trace.setBusinessId(resellerId);

    const reseller = await requireSupplierAccess(session, resellerId);
    const supplierId = session.role === Role.ADMIN ? (reseller.supplierId ?? session.userId) : session.userId;

    const [supplierItems, resellerItems] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { ownerId: supplierId },
        include: { product: { select: { name: true, sku: true, price: true } } },
        orderBy: { product: { name: 'asc' } },
      }),
      prisma.inventoryItem.findMany({
        where: { ownerId: resellerId },
        select: { productId: true, stock: true, costPrice: true },
      }),
    ]);
    const resellerByProduct = new Map(resellerItems.map((item) => [item.productId, item]));

    trace.addStep(`precios-revendedor:${supplierItems.length}`);

    return {
      reseller: { id: reseller.id, name: reseller.name, email: reseller.email },
      rows: supplierItems.map((item) => ({
        productId: item.productId,
        name: item.product.name,
        sku: item.product.sku,
        resellerStock: resellerByProduct.get(item.productId)?.stock ?? 0,
        costPrice: resellerByProduct.get(item.productId)?.costPrice ?? null,
        referencePrice: effectiveSalePrice(item, item.product),
      })),
    };
  });
}

/**
 * Fija el costo que paga un revendedor por un producto (vacio lo deja sin costo propio). Si el producto todavia no esta
 * en su inventario se agrega con stock 0, para que el precio quede listo antes de transferirle mercancia.
 */
export async function setResellerCost(
  resellerId: string,
  productId: string,
  costPrice: string | number | null,
): Promise<ActionResult<{ costPrice: number | null }>> {
  return executeAction('pricing.setResellerCost', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);
    trace.setBusinessId(resellerId);

    await requireSupplierAccess(session, resellerId);
    const cost = optionalNonNegativeNumber(costPrice, 'costo');

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { isActive: true } });

    if (!product?.isActive) {
      throw new ProductNotFoundError(productId);
    }

    await prisma.inventoryItem.upsert({
      where: { ownerId_productId: { ownerId: resellerId, productId } },
      update: { costPrice: cost },
      create: { ownerId: resellerId, productId, costPrice: cost },
    });

    trace.addStep(`costo-revendedor:${productId}:${cost ?? 'SIN-COSTO'}`);
    revalidatePriceViews();

    return { costPrice: cost };
  });
}

/** El dueno fija a cuanto vende un producto (vacio vuelve al precio del catalogo). El administrador puede hacerlo por cualquiera. */
export async function setSalePrice(
  inventoryItemId: string,
  salePrice: string | number | null,
): Promise<ActionResult<{ price: number }>> {
  return executeAction('pricing.setSalePrice', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);
    trace.setBusinessId(inventoryItemId);

    const isClearing = salePrice === null || (typeof salePrice === 'string' && !salePrice.trim());
    const price = isClearing ? null : requirePositiveNumber(salePrice, 'precio de venta');

    const item = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      select: { ownerId: true, product: { select: { price: true } } },
    });

    if (!item) {
      throw new InventoryItemNotFoundError(inventoryItemId);
    }

    assertOwnsInventory(session, item.ownerId);

    await prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { salePrice: price } });

    trace.addStep(`precio-venta:${price ?? 'CATALOGO'}`);
    revalidatePriceViews();

    return { price: price ?? item.product.price };
  });
}
