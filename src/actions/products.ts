'use server';

import { Prisma, type MovementType, type Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import {
  InsufficientStockError,
  InventoryItemNotFoundError,
  ProductAlreadyInInventoryError,
  ProductNotFoundError,
} from '@/lib/errors';
import { applyStockChange } from '@/lib/inventory-movements';
import { effectiveCostPrice, effectiveSalePrice } from '@/lib/inventory-prices';
import { assertOwnsInventory, resolveActingOwnerId, resolveOwnerFilter } from '@/lib/inventory-scope';
import { INVENTORY_ROLES } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { requireEnumValue, requireNonNegativeInteger, requirePositiveInteger, requireText } from '@/lib/validation';

const INVENTORY_ROUTE = '/admin/inventario';
const SALES_ROUTE = '/admin/ventas';
// El nombre del producto aparece tambien en el inicio, las entregas y el reporte.
const INVENTORY_VIEWS = [INVENTORY_ROUTE, SALES_ROUTE, '/admin/dashboard', '/admin/entregas', '/admin/reporte'];

/**
 * Producto del catalogo tal como esta en un inventario: `id` es el del catalogo (el que se vende).
 * Los precios son los efectivos del dueno: `costPrice` lo que le cuesta y `price` a lo que vende.
 */
export interface InventoryProduct {
  id: string;
  inventoryItemId: string;
  ownerId: string;
  name: string;
  sku: string | null;
  costPrice: number;
  price: number;
  /** Precio de venta propio; null si usa el del catalogo. */
  customSalePrice: number | null;
  /** Puede ser negativo: unidades vendidas sin stock que faltan por reponer. */
  stock: number;
}

export interface InventoryOwner {
  id: string;
  name: string | null;
  email: string;
  role: Role;
}

export interface CatalogOption {
  id: string;
  name: string;
  sku: string | null;
}

export interface AddToInventoryInput {
  productId: string;
  /** Solo el administrador: agrega el producto al inventario de ese usuario. */
  ownerId?: string;
  /** Stock inicial; si es mayor que cero se registra como una entrada con su motivo. */
  quantity: number;
  reason?: string;
}

export interface MovementInput {
  type: 'ENTRY' | 'EXIT';
  quantity: number;
  reason: string;
}

export interface MovementView {
  id: string;
  type: MovementType;
  quantity: number;
  stockAfter: number;
  reason: string;
  userName: string;
  createdAt: Date;
}

/** Movimiento manual (entrada o salida que no viene de una venta), con el producto al que afecta. */
export interface ManualMovementView extends MovementView {
  productName: string;
  productSku: string | null;
}

const ITEM_WITH_PRODUCT = {
  product: { select: { id: true, name: true, sku: true, costPrice: true, price: true } },
  owner: { select: { role: true } },
} satisfies Prisma.InventoryItemInclude;
type ItemWithProduct = Prisma.InventoryItemGetPayload<{ include: typeof ITEM_WITH_PRODUCT }>;

function toInventoryProduct(item: ItemWithProduct): InventoryProduct {
  return {
    id: item.productId,
    inventoryItemId: item.id,
    ownerId: item.ownerId,
    name: item.product.name,
    sku: item.product.sku,
    costPrice: effectiveCostPrice(item, item.product, item.owner.role),
    price: effectiveSalePrice(item, item.product),
    customSalePrice: item.salePrice,
    stock: item.stock,
  };
}

function revalidateInventoryViews(): void {
  for (const route of INVENTORY_VIEWS) {
    revalidatePath(route);
  }
}

/**
 * Productos de un inventario. Sin parametro: el propio. El administrador puede pedir el de otro usuario
 * (por su id) o `ALL` para ver todos; los demas roles siempre reciben solo el suyo.
 */
export async function getProducts(owner?: string): Promise<ActionResult<InventoryProduct[]>> {
  return executeAction('products.getProducts', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);

    const items = await prisma.inventoryItem.findMany({
      where: resolveOwnerFilter(session, owner, false),
      include: ITEM_WITH_PRODUCT,
      orderBy: { product: { name: 'asc' } },
    });
    trace.addStep(`productos-listados:${items.length}`);

    return items.map(toInventoryProduct);
  });
}

/**
 * Productos para vender: los del inventario mas los del catalogo que el dueno aun no tiene (stock 0, sin
 * `inventoryItemId`). Al vender uno de estos, la venta crea su registro de inventario y el stock queda en negativo.
 */
export async function getSellableProducts(owner?: string): Promise<ActionResult<InventoryProduct[]>> {
  return executeAction('products.getSellableProducts', async () => {
    const session = await requireRole(...INVENTORY_ROLES);
    const ownerFilter = resolveOwnerFilter(session, owner, false);

    const [items, catalog, owners] = await Promise.all([
      prisma.inventoryItem.findMany({ where: ownerFilter, include: ITEM_WITH_PRODUCT }),
      prisma.product.findMany({ where: { isActive: true } }),
      prisma.user.findMany({
        where: { isActive: true, role: { in: INVENTORY_ROLES }, ...(ownerFilter.ownerId ? { id: ownerFilter.ownerId } : {}) },
        select: { id: true },
      }),
    ]);

    const products = items.map(toInventoryProduct);
    const owned = new Set(items.map((item) => `${item.ownerId}:${item.productId}`));

    for (const { id: ownerId } of owners) {
      for (const product of catalog) {
        if (!owned.has(`${ownerId}:${product.id}`)) {
          products.push({
            id: product.id,
            inventoryItemId: '',
            ownerId,
            name: product.name,
            sku: product.sku,
            costPrice: product.costPrice,
            price: product.price,
            customSalePrice: null,
            stock: 0,
          });
        }
      }
    }

    return products.sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Usuarios con inventario propio: el administrador ve a todos los activos; los demas, solo a si mismos. */
export async function getInventoryOwners(): Promise<ActionResult<InventoryOwner[]>> {
  return executeAction('products.getInventoryOwners', async () => {
    const session = await requireRole(...INVENTORY_ROLES);

    return prisma.user.findMany({
      where:
        session.role === 'ADMIN'
          ? { isActive: true, role: { in: INVENTORY_ROLES } }
          : { id: session.userId },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, email: true, role: true },
    });
  });
}

/** Productos del catalogo que todavia no estan en el inventario indicado (el propio si no se indica otro). */
export async function getAvailableCatalog(owner?: string): Promise<ActionResult<CatalogOption[]>> {
  return executeAction('products.getAvailableCatalog', async () => {
    const session = await requireRole(...INVENTORY_ROLES);
    const ownerId = await resolveActingOwnerId(session, owner);

    return prisma.product.findMany({
      where: { isActive: true, inventoryItems: { none: { ownerId } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sku: true },
    });
  });
}

/** Agrega un producto del catalogo al inventario con su stock inicial: los precios los define el catalogo. */
export async function addToInventory(input: AddToInventoryInput): Promise<ActionResult<InventoryProduct>> {
  return executeAction('products.addToInventory', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);

    const productId = requireText(input.productId, 'producto');
    const quantity = requireNonNegativeInteger(input.quantity, 'cantidad');
    const reason = quantity > 0 ? requireText(input.reason, 'descripcion', 500) : null;
    const ownerId = await resolveActingOwnerId(session, input.ownerId);
    trace.setBusinessId(productId);

    const createdItem = await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findUnique({ where: { id: productId } });

      if (!product || !product.isActive) {
        throw new ProductNotFoundError(productId);
      }

      const item = await transaction.inventoryItem
        .create({ data: { ownerId, productId }, include: ITEM_WITH_PRODUCT })
        .catch((error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ProductAlreadyInInventoryError(product.name);
          }

          throw error;
        });

      if (!reason) {
        return item;
      }

      const stock = await applyStockChange(transaction, {
        inventoryItemId: item.id,
        delta: quantity,
        type: 'ENTRY',
        reason,
        userId: session.userId,
      });

      return { ...item, stock: stock ?? item.stock };
    });

    trace.addStep(`agregado-al-inventario:stock=${createdItem.stock}`);
    revalidateInventoryViews();

    return toInventoryProduct(createdItem);
  });
}

/** Entrada o salida manual de stock. La descripcion es obligatoria y queda en el historial. */
export async function registerMovement(
  inventoryItemId: string,
  input: MovementInput,
): Promise<ActionResult<InventoryProduct>> {
  return executeAction('products.registerMovement', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);
    trace.setBusinessId(inventoryItemId);

    const type = requireEnumValue(input.type, { ENTRY: 'ENTRY', EXIT: 'EXIT' } as const, 'tipo de movimiento');
    const quantity = requirePositiveInteger(input.quantity, 'cantidad');
    const reason = requireText(input.reason, 'descripcion', 500);

    const updatedItem = await prisma.$transaction(async (transaction) => {
      const item = await transaction.inventoryItem.findUnique({
        where: { id: inventoryItemId },
        include: ITEM_WITH_PRODUCT,
      });

      if (!item) {
        throw new InventoryItemNotFoundError(inventoryItemId);
      }

      assertOwnsInventory(session, item.ownerId);

      const stock = await applyStockChange(transaction, {
        inventoryItemId,
        delta: type === 'EXIT' ? -quantity : quantity,
        type,
        reason,
        userId: session.userId,
      });

      if (stock === null) {
        throw new InsufficientStockError(item.product.name, item.stock);
      }

      return { ...item, stock };
    });

    trace.addStep(`movimiento:${type}:${quantity}`);
    revalidateInventoryViews();

    return toInventoryProduct(updatedItem);
  });
}

/** Ultimos movimientos de stock de un producto del inventario, del mas reciente al mas antiguo. */
export async function getMovements(inventoryItemId: string): Promise<ActionResult<MovementView[]>> {
  return executeAction('products.getMovements', async () => {
    const session = await requireRole(...INVENTORY_ROLES);

    const item = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      select: { ownerId: true },
    });

    if (!item) {
      throw new InventoryItemNotFoundError(inventoryItemId);
    }

    assertOwnsInventory(session, item.ownerId);

    const movements = await prisma.inventoryMovement.findMany({
      where: { inventoryItemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true, email: true } } },
    });

    return movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      stockAfter: movement.stockAfter,
      reason: movement.reason,
      userName: movement.user.name ?? movement.user.email,
      createdAt: movement.createdAt,
    }));
  });
}

/**
 * Ultimas entradas, salidas y transferencias manuales de un inventario (las que no vienen de una venta), de la mas
 * reciente a la mas antigua. Sin parametro: el propio; el administrador puede pedir el de otro usuario o `ALL`.
 */
export async function getManualMovements(owner?: string): Promise<ActionResult<ManualMovementView[]>> {
  return executeAction('products.getManualMovements', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        type: { in: ['ENTRY', 'EXIT', 'TRANSFER_OUT', 'TRANSFER_IN'] },
        orderId: null,
        inventoryItem: resolveOwnerFilter(session, owner, false),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { name: true, email: true } },
        inventoryItem: { select: { product: { select: { name: true, sku: true } } } },
      },
    });
    trace.addStep(`movimientos-manuales:${movements.length}`);

    return movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      stockAfter: movement.stockAfter,
      reason: movement.reason,
      userName: movement.user.name ?? movement.user.email,
      createdAt: movement.createdAt,
      productName: movement.inventoryItem.product.name,
      productSku: movement.inventoryItem.product.sku,
    }));
  });
}
