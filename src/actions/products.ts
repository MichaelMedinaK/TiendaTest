'use server';

import { DeliveryStatus, PaymentStatus, Prisma, type Product } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { OPEN_DELIVERY_STATUSES } from '@/lib/constants';
import { ProductInUseError, ProductNotFoundError, SkuAlreadyRegisteredError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import {
  optionalText,
  requireNonNegativeInteger,
  requirePositiveNumber,
  requireText,
} from '@/lib/validation';

const INVENTORY_ROUTE = '/admin/inventario';
const SALES_ROUTE = '/admin/ventas';
// El nombre del producto aparece tambien en el inicio, las entregas y el reporte.
const PRODUCT_VIEWS = [INVENTORY_ROUTE, SALES_ROUTE, '/admin/dashboard', '/admin/entregas', '/admin/reporte'];

export interface CreateProductInput {
  name: string;
  price: number;
  stock: number;
  sku?: string;
}

export interface UpdateProductDetailsInput {
  name: string;
  sku?: string;
  price: number;
}

/** El SKU es unico: un duplicado se informa con un mensaje claro en lugar de un error tecnico. */
function rethrowDuplicatedSku(error: unknown, sku: string | null): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && sku) {
    throw new SkuAlreadyRegisteredError(sku);
  }

  throw error;
}

function revalidateProductViews(): void {
  for (const route of PRODUCT_VIEWS) {
    revalidatePath(route);
  }
}

export async function getProducts(): Promise<ActionResult<Product[]>> {
  return executeAction('products.getProducts', async (trace) => {
    await requireRole('ADMIN', 'STAFF');

    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    trace.addStep(`productos-listados:${products.length}`);

    return products;
  });
}

export async function createProduct(input: CreateProductInput): Promise<ActionResult<Product>> {
  return executeAction('products.createProduct', async (trace) => {
    await requireRole('ADMIN', 'STAFF');

    const name = requireText(input.name, 'nombre');
    const price = requirePositiveNumber(input.price, 'precio');
    const stock = requireNonNegativeInteger(input.stock, 'stock');
    const sku = optionalText(input.sku, 50);
    trace.addStep('datos-validados');

    const createdProduct = await prisma.product
      .create({ data: { name, price, stock, sku } })
      .catch((error) => rethrowDuplicatedSku(error, sku));
    trace.setBusinessId(createdProduct.id);
    trace.addStep('producto-creado');

    revalidateProductViews();

    return createdProduct;
  });
}

/** Producto actualizado, con la cantidad de ventas pendientes que se recalcularon por el cambio de precio. */
export type UpdatedProduct = Product & { updatedOrdersCount: number };

/** Ventas "actuales": falta enviarlas o cobrarlas. Las ya cerradas (entregadas y pagadas, o devueltas) no se tocan. */
const OPEN_ORDER_FILTER = {
  OR: [
    { deliveryStatus: { in: OPEN_DELIVERY_STATUSES } },
    { deliveryStatus: DeliveryStatus.DELIVERED, paymentStatus: PaymentStatus.PENDING },
  ],
} satisfies Prisma.OrderWhereInput;

/**
 * Edita nombre, SKU y precio. Si cambia el precio, las ventas pendientes que incluyan el producto con el
 * precio anterior pasan al nuevo y se recalcula su total. Las ventas cerradas y los precios puestos a mano
 * en una venta no se modifican.
 */
export async function updateProductDetails(
  productId: string,
  input: UpdateProductDetailsInput,
): Promise<ActionResult<UpdatedProduct>> {
  return executeAction('products.updateDetails', async (trace) => {
    await requireRole('ADMIN', 'STAFF');
    trace.setBusinessId(productId);

    const name = requireText(input.name, 'nombre');
    const sku = optionalText(input.sku, 50);
    const price = requirePositiveNumber(input.price, 'precio');

    const result = await prisma.$transaction(async (transaction) => {
      const currentProduct = await transaction.product.findUnique({
        where: { id: productId },
        select: { price: true },
      });

      if (!currentProduct) {
        throw new ProductNotFoundError(productId);
      }

      const updatedProduct = await transaction.product
        .update({ where: { id: productId }, data: { name, sku, price } })
        .catch((error) => rethrowDuplicatedSku(error, sku));

      const updatedOrdersCount =
        updatedProduct.price === currentProduct.price
          ? 0
          : await repriceOpenOrders(transaction, productId, currentProduct.price, updatedProduct.price);

      return { ...updatedProduct, updatedOrdersCount };
    });

    trace.addStep(`producto-actualizado:ventas-recalculadas=${result.updatedOrdersCount}`);

    revalidateProductViews();

    return result;
  });
}

async function repriceOpenOrders(
  transaction: Prisma.TransactionClient,
  productId: string,
  previousPrice: number,
  newPrice: number,
): Promise<number> {
  const itemsToReprice = { productId, unitPrice: previousPrice, order: OPEN_ORDER_FILTER } satisfies Prisma.OrderItemWhereInput;

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
  }

  return orderIds.length;
}

/** Elimina un producto que nunca se vendio; si ya figura en ventas se bloquea para no romper el historial. */
export async function deleteProduct(productId: string): Promise<ActionResult<void>> {
  return executeAction('products.deleteProduct', async (trace) => {
    await requireRole('ADMIN', 'STAFF');
    trace.setBusinessId(productId);

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, _count: { select: { orderItems: true } } },
    });

    if (!existingProduct) {
      throw new ProductNotFoundError(productId);
    }

    if (existingProduct._count.orderItems > 0) {
      throw new ProductInUseError(existingProduct.name, existingProduct._count.orderItems);
    }

    await prisma.product.delete({ where: { id: productId } });
    trace.addStep('producto-eliminado');

    revalidateProductViews();
  });
}

export async function updateStock(productId: string, newStock: number): Promise<ActionResult<Product>> {
  return executeAction('products.updateStock', async (trace) => {
    await requireRole('ADMIN', 'STAFF');
    trace.setBusinessId(productId);

    const stock = requireNonNegativeInteger(newStock, 'stock');
    const existingProduct = await prisma.product.findUnique({ where: { id: productId } });

    if (!existingProduct) {
      throw new ProductNotFoundError(productId);
    }

    const updatedProduct = await prisma.product.update({ where: { id: productId }, data: { stock } });
    trace.addStep(`stock-actualizado:${existingProduct.stock}->${stock}`);

    revalidateProductViews();

    return updatedProduct;
  });
}
