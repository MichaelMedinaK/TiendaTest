'use server';

import { DeliveryStatus, PaymentStatus, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { OPEN_DELIVERY_STATUSES } from '@/lib/constants';
import {
  InsufficientStockError,
  InventoryItemNotFoundError,
  ProductAlreadyInInventoryError,
  ProductNotFoundError,
} from '@/lib/errors';
import { applyStockChange } from '@/lib/inventory-movements';
import { assertOwnsInventory, resolveActingOwnerId, resolveOwnerFilter } from '@/lib/inventory-scope';
import { INVENTORY_ROLES } from '@/lib/permissions';
import { refreshPaymentStatus } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import {
  optionalNonNegativeNumber,
  requireEnumValue,
  requireNonNegativeInteger,
  requirePositiveInteger,
  requirePositiveNumber,
  requireText,
} from '@/lib/validation';

const INVENTORY_ROUTE = '/admin/inventario';
const SALES_ROUTE = '/admin/ventas';
// El nombre del producto aparece tambien en el inicio, las entregas y el reporte.
const INVENTORY_VIEWS = [INVENTORY_ROUTE, SALES_ROUTE, '/admin/dashboard', '/admin/entregas', '/admin/reporte'];

/** Producto del catalogo tal como esta en un inventario: `id` es el del catalogo (el que se vende). */
export interface InventoryProduct {
  id: string;
  inventoryItemId: string;
  ownerId: string;
  name: string;
  sku: string | null;
  costPrice: number;
  price: number;
  stock: number;
}

export interface InventoryOwner {
  id: string;
  name: string | null;
  email: string;
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
  /** Precio real (lo que cuesta el producto). */
  costPrice: number;
  /** Precio de venta. */
  price: number;
  /** Stock inicial; si es mayor que cero se registra como una entrada con su motivo. */
  quantity: number;
  reason?: string;
}

export interface UpdatePricesInput {
  costPrice: number;
  price: number;
}

export interface MovementInput {
  type: 'ENTRY' | 'EXIT';
  quantity: number;
  reason: string;
}

export interface MovementView {
  id: string;
  type: 'ENTRY' | 'EXIT' | 'SALE' | 'SALE_RETURN';
  quantity: number;
  stockAfter: number;
  reason: string;
  userName: string;
  createdAt: Date;
}

const ITEM_WITH_PRODUCT = { product: { select: { id: true, name: true, sku: true } } } satisfies Prisma.InventoryItemInclude;
type ItemWithProduct = Prisma.InventoryItemGetPayload<{ include: typeof ITEM_WITH_PRODUCT }>;

function toInventoryProduct(item: ItemWithProduct): InventoryProduct {
  return {
    id: item.productId,
    inventoryItemId: item.id,
    ownerId: item.ownerId,
    name: item.product.name,
    sku: item.product.sku,
    costPrice: item.costPrice,
    price: item.price,
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
      select: { id: true, name: true, email: true },
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

/** Agrega un producto del catalogo al inventario con su costo, precio de venta y stock inicial. */
export async function addToInventory(input: AddToInventoryInput): Promise<ActionResult<InventoryProduct>> {
  return executeAction('products.addToInventory', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);

    const productId = requireText(input.productId, 'producto');
    const price = requirePositiveNumber(input.price, 'precio de venta');
    const costPrice = optionalNonNegativeNumber(input.costPrice, 'precio real') ?? 0;
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
        .create({ data: { ownerId, productId, price, costPrice }, include: ITEM_WITH_PRODUCT })
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

/** Ventas "actuales": falta enviarlas o cobrarlas. Las ya cerradas (entregadas y pagadas, o devueltas) no se tocan. */
const OPEN_ORDER_FILTER = {
  OR: [
    { deliveryStatus: { in: OPEN_DELIVERY_STATUSES } },
    { deliveryStatus: DeliveryStatus.DELIVERED, paymentStatus: { not: PaymentStatus.PAID } },
  ],
} satisfies Prisma.OrderWhereInput;

/** Producto actualizado, con la cantidad de ventas pendientes que se recalcularon por el cambio de precio. */
export type UpdatedInventoryProduct = InventoryProduct & { updatedOrdersCount: number };

/**
 * Edita el precio real y el precio de venta. Si cambia el precio de venta, las ventas pendientes de ese vendedor
 * que incluyan el producto con el precio anterior pasan al nuevo y se recalcula su total. Las ventas cerradas, los
 * costos ya registrados y los precios puestos a mano en una venta no se modifican.
 */
export async function updateInventoryPrices(
  inventoryItemId: string,
  input: UpdatePricesInput,
): Promise<ActionResult<UpdatedInventoryProduct>> {
  return executeAction('products.updatePrices', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);
    trace.setBusinessId(inventoryItemId);

    const price = requirePositiveNumber(input.price, 'precio de venta');
    const costPrice = optionalNonNegativeNumber(input.costPrice, 'precio real') ?? 0;

    const result = await prisma.$transaction(async (transaction) => {
      const currentItem = await transaction.inventoryItem.findUnique({ where: { id: inventoryItemId } });

      if (!currentItem) {
        throw new InventoryItemNotFoundError(inventoryItemId);
      }

      assertOwnsInventory(session, currentItem.ownerId);

      const updatedItem = await transaction.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { price, costPrice },
        include: ITEM_WITH_PRODUCT,
      });

      const updatedOrdersCount =
        updatedItem.price === currentItem.price
          ? 0
          : await repriceOpenOrders(transaction, currentItem.ownerId, currentItem.productId, currentItem.price, price);

      return { ...toInventoryProduct(updatedItem), updatedOrdersCount };
    });

    trace.addStep(`precios-actualizados:ventas-recalculadas=${result.updatedOrdersCount}`);
    revalidateInventoryViews();

    return result;
  });
}

async function repriceOpenOrders(
  transaction: Prisma.TransactionClient,
  sellerId: string,
  productId: string,
  previousPrice: number,
  newPrice: number,
): Promise<number> {
  const itemsToReprice = {
    productId,
    unitPrice: previousPrice,
    order: { AND: [OPEN_ORDER_FILTER, { sellerId }] },
  } satisfies Prisma.OrderItemWhereInput;

  const affectedItems = await transaction.orderItem.findMany({ where: itemsToReprice, select: { orderId: true } });
  const orderIds = [...new Set(affectedItems.map((item) => item.orderId))];

  if (orderIds.length === 0) {
    return 0;
  }

  await transaction.orderItem.updateMany({ where: itemsToReprice, data: { unitPrice: newPrice } });

  for (const orderId of orderIds) {
    const [items, order] = await Promise.all([
      transaction.orderItem.findMany({ where: { orderId }, select: { quantity: true, unitPrice: true } }),
      transaction.order.findUniqueOrThrow({ where: { id: orderId }, select: { shippingPrice: true } }),
    ]);
    const itemsTotal = items.reduce((accumulated, item) => accumulated + item.unitPrice * item.quantity, 0);

    await transaction.order.update({
      where: { id: orderId },
      data: { total: Math.round((itemsTotal + order.shippingPrice) * 100) / 100 },
    });
    await refreshPaymentStatus(transaction, orderId);
  }

  return orderIds.length;
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
