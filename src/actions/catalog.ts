'use server';

import { DeliveryStatus, PaymentStatus, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { OPEN_DELIVERY_STATUSES } from '@/lib/constants';
import { ProductInInventoryError, ProductInUseError, ProductNotFoundError, SkuAlreadyRegisteredError } from '@/lib/errors';
import { refreshPaymentStatus } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { optionalNonNegativeNumber, optionalText, requirePositiveNumber, requireText } from '@/lib/validation';

const CATALOG_ROUTE = '/admin/catalogo';
const CATALOG_VIEWS = [CATALOG_ROUTE, '/admin/inventario', '/admin/ventas', '/admin/dashboard', '/admin/entregas', '/admin/reporte'];

export interface CatalogProduct {
  id: string;
  name: string;
  sku: string | null;
  /** Precio real (lo que cuesta el producto). */
  costPrice: number;
  /** Precio de venta. */
  price: number;
  inventoriesCount: number;
  salesCount: number;
  /** Solo al editar: ventas pendientes que se recalcularon por el cambio del precio de venta. */
  updatedOrdersCount?: number;
}

export interface CatalogProductInput {
  name: string;
  sku?: string;
  costPrice: number;
  price: number;
}

const CATALOG_SELECT = {
  id: true,
  name: true,
  sku: true,
  costPrice: true,
  price: true,
  _count: { select: { inventoryItems: true, orderItems: true } },
} satisfies Prisma.ProductSelect;

function toCatalogProduct(product: Prisma.ProductGetPayload<{ select: typeof CATALOG_SELECT }>): CatalogProduct {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    costPrice: product.costPrice,
    price: product.price,
    inventoriesCount: product._count.inventoryItems,
    salesCount: product._count.orderItems,
  };
}

/** El SKU es unico: un duplicado se informa con un mensaje claro en lugar de un error tecnico. */
function rethrowDuplicatedSku(error: unknown, sku: string | null): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && sku) {
    throw new SkuAlreadyRegisteredError(sku);
  }

  throw error;
}

function revalidateCatalogViews(): void {
  for (const route of CATALOG_VIEWS) {
    revalidatePath(route);
  }
}

/** Catalogo general de productos con sus precios (solo ADMIN). Cada vendedor agrega a su inventario los que vende. */
export async function getCatalog(): Promise<ActionResult<CatalogProduct[]>> {
  return executeAction('catalog.getCatalog', async (trace) => {
    await requireRole('ADMIN');

    const products = await prisma.product.findMany({ orderBy: { name: 'asc' }, select: CATALOG_SELECT });
    trace.addStep(`catalogo-listado:${products.length}`);

    return products.map(toCatalogProduct);
  });
}

export async function createCatalogProduct(input: CatalogProductInput): Promise<ActionResult<CatalogProduct>> {
  return executeAction('catalog.createProduct', async (trace) => {
    await requireRole('ADMIN');

    const name = requireText(input.name, 'nombre');
    const sku = optionalText(input.sku, 50);
    const price = requirePositiveNumber(input.price, 'precio de venta');
    const costPrice = optionalNonNegativeNumber(input.costPrice, 'precio real') ?? 0;

    const product = await prisma.product
      .create({ data: { name, sku, price, costPrice }, select: CATALOG_SELECT })
      .catch((error) => rethrowDuplicatedSku(error, sku));
    trace.setBusinessId(product.id);

    revalidateCatalogViews();
    return toCatalogProduct(product);
  });
}

/** Ventas "actuales": falta enviarlas o cobrarlas. Las ya cerradas (entregadas y pagadas, o devueltas) no se tocan. */
const OPEN_ORDER_FILTER = {
  OR: [
    { deliveryStatus: { in: OPEN_DELIVERY_STATUSES } },
    { deliveryStatus: DeliveryStatus.DELIVERED, paymentStatus: { not: PaymentStatus.PAID } },
  ],
} satisfies Prisma.OrderWhereInput;

/**
 * Edita el nombre, el SKU y los precios. Si cambia el precio de venta, las ventas pendientes que incluyan el
 * producto con el precio anterior pasan al nuevo y se recalcula su total. Las ventas cerradas, los costos ya
 * registrados y los precios puestos a mano en una venta no se modifican.
 */
export async function updateCatalogProduct(
  productId: string,
  input: CatalogProductInput,
): Promise<ActionResult<CatalogProduct>> {
  return executeAction('catalog.updateProduct', async (trace) => {
    await requireRole('ADMIN');
    trace.setBusinessId(productId);

    const name = requireText(input.name, 'nombre');
    const sku = optionalText(input.sku, 50);
    const price = requirePositiveNumber(input.price, 'precio de venta');
    const costPrice = optionalNonNegativeNumber(input.costPrice, 'precio real') ?? 0;

    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.product.findUnique({ where: { id: productId }, select: { price: true } });

      if (!existing) {
        throw new ProductNotFoundError(productId);
      }

      const product = await transaction.product
        .update({ where: { id: productId }, data: { name, sku, price, costPrice }, select: CATALOG_SELECT })
        .catch((error) => rethrowDuplicatedSku(error, sku));
      const updatedOrdersCount =
        existing.price === price ? 0 : await repriceOpenOrders(transaction, productId, existing.price, price);

      return { ...toCatalogProduct(product), updatedOrdersCount };
    });

    trace.addStep(`producto-actualizado:ventas-recalculadas=${result.updatedOrdersCount}`);
    revalidateCatalogViews();
    return result;
  });
}

async function repriceOpenOrders(
  transaction: Prisma.TransactionClient,
  productId: string,
  previousPrice: number,
  newPrice: number,
): Promise<number> {
  const itemsToReprice = {
    productId,
    unitPrice: previousPrice,
    order: OPEN_ORDER_FILTER,
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

/** Elimina un producto que no esta en ningun inventario ni en ventas, para no romper el historial. */
export async function deleteCatalogProduct(productId: string): Promise<ActionResult<void>> {
  return executeAction('catalog.deleteProduct', async (trace) => {
    await requireRole('ADMIN');
    trace.setBusinessId(productId);

    const product = await prisma.product.findUnique({ where: { id: productId }, select: CATALOG_SELECT });

    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    if (product._count.orderItems > 0) {
      throw new ProductInUseError(product.name, product._count.orderItems);
    }

    if (product._count.inventoryItems > 0) {
      throw new ProductInInventoryError(product.name, product._count.inventoryItems);
    }

    await prisma.product.delete({ where: { id: productId } });
    trace.addStep('producto-eliminado');

    revalidateCatalogViews();
  });
}
