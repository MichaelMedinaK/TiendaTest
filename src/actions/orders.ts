'use server';

import { DeliveryStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { InsufficientStockError, OrderNotFoundError, ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import {
  optionalText,
  requireEnumValue,
  requirePositiveInteger,
  requireText,
} from '@/lib/validation';

const SALES_ROUTE = '/admin/ventas';
const INVENTORY_ROUTE = '/admin/inventario';
const DASHBOARD_ROUTE = '/admin/dashboard';
const REPORT_ROUTE = '/admin/reporte';

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface OrderInput {
  description: string;
  reference?: string;
  address?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  items: OrderItemInput[];
}

const ORDER_WITH_ITEMS = {
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
} satisfies Prisma.OrderInclude;

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof ORDER_WITH_ITEMS }>;

type TransactionClient = Prisma.TransactionClient;
type StockMovement = { productId: string; quantity: number };

export async function getOrders(): Promise<ActionResult<OrderWithItems[]>> {
  return executeAction('orders.getOrders', async (trace) => {
    await requireSession();

    const orders = await prisma.order.findMany({
      include: ORDER_WITH_ITEMS,
      orderBy: { createdAt: 'desc' },
    });

    trace.addStep(`ventas-listadas:${orders.length}`);
    return orders;
  });
}

/**
 * Registra la venta y descuenta el stock dentro de una unica transaccion.
 * El precio unitario se toma del catalogo (nunca del cliente) para evitar manipulacion de totales.
 */
export async function createOrder(input: OrderInput): Promise<ActionResult<OrderWithItems>> {
  return executeAction('orders.createOrder', async (trace) => {
    await requireSession();

    const orderData = parseOrderInput(input);
    trace.addStep(`datos-validados:${orderData.items.length}-items`);

    const createdOrder = await prisma.$transaction(async (transaction) => {
      const { orderItems, total } = await reserveStock(transaction, orderData.items);

      return transaction.order.create({
        data: { ...orderData.fields, total, items: { create: orderItems } },
        include: ORDER_WITH_ITEMS,
      });
    });

    trace.setBusinessId(createdOrder.id);
    trace.addStep(`venta-registrada:total=${createdOrder.total}`);

    revalidateSalesViews();
    return createdOrder;
  });
}

/**
 * Edita la venta completa. Primero devuelve al inventario lo que la venta tenia reservado
 * y luego reserva los productos nuevos, de modo que el stock siempre queda consistente.
 */
export async function updateOrder(orderId: string, input: OrderInput): Promise<ActionResult<OrderWithItems>> {
  return executeAction('orders.updateOrder', async (trace) => {
    await requireSession();
    trace.setBusinessId(orderId);

    const orderData = parseOrderInput(input);

    const updatedOrder = await prisma.$transaction(async (transaction) => {
      const currentOrder = await transaction.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!currentOrder) {
        throw new OrderNotFoundError(orderId);
      }

      await restoreStock(transaction, currentOrder.items);
      const { orderItems, total } = await reserveStock(transaction, orderData.items);

      return transaction.order.update({
        where: { id: orderId },
        data: { ...orderData.fields, total, items: { deleteMany: {}, create: orderItems } },
        include: ORDER_WITH_ITEMS,
      });
    });

    trace.addStep(`venta-editada:total=${updatedOrder.total}`);

    revalidateSalesViews();
    return updatedOrder;
  });
}

export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
): Promise<ActionResult<OrderWithItems>> {
  return executeAction('orders.updatePaymentStatus', async (trace) => {
    await requireSession();
    trace.setBusinessId(orderId);

    const newPaymentStatus = requireEnumValue(paymentStatus, PaymentStatus, 'estado del pago');
    await ensureOrderExists(orderId);

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: newPaymentStatus },
      include: ORDER_WITH_ITEMS,
    });

    trace.addStep(`estado-pago:${updatedOrder.paymentStatus}`);

    revalidateSalesViews();
    return updatedOrder;
  });
}

export async function updateDeliveryStatus(
  orderId: string,
  deliveryStatus: DeliveryStatus,
): Promise<ActionResult<OrderWithItems>> {
  return executeAction('orders.updateDeliveryStatus', async (trace) => {
    await requireSession();
    trace.setBusinessId(orderId);

    const newDeliveryStatus = requireEnumValue(deliveryStatus, DeliveryStatus, 'estado de envio');
    await ensureOrderExists(orderId);

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { deliveryStatus: newDeliveryStatus },
      include: ORDER_WITH_ITEMS,
    });

    trace.addStep(`estado-envio:${updatedOrder.deliveryStatus}`);

    revalidateSalesViews();
    return updatedOrder;
  });
}

/** Elimina la venta y devuelve sus unidades al inventario. */
export async function deleteOrder(orderId: string): Promise<ActionResult<void>> {
  return executeAction('orders.deleteOrder', async (trace) => {
    await requireSession();
    trace.setBusinessId(orderId);

    await prisma.$transaction(async (transaction) => {
      const currentOrder = await transaction.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!currentOrder) {
        throw new OrderNotFoundError(orderId);
      }

      await restoreStock(transaction, currentOrder.items);
      await transaction.order.delete({ where: { id: orderId } });
    });

    trace.addStep('venta-eliminada-stock-devuelto');

    revalidateSalesViews();
  });
}

async function ensureOrderExists(orderId: string): Promise<void> {
  const existingOrder = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });

  if (!existingOrder) {
    throw new OrderNotFoundError(orderId);
  }
}

function parseOrderInput(input: OrderInput) {
  return {
    fields: {
      description: requireText(input.description, 'descripcion', 500),
      reference: optionalText(input.reference, 100),
      address: optionalText(input.address, 500),
      paymentMethod: requireEnumValue(input.paymentMethod, PaymentMethod, 'metodo de pago'),
      paymentStatus: requireEnumValue(input.paymentStatus, PaymentStatus, 'estado del pago'),
      deliveryStatus: requireEnumValue(input.deliveryStatus, DeliveryStatus, 'estado de envio'),
    },
    items: mergeDuplicatedItems(input.items),
  };
}

async function reserveStock(transaction: TransactionClient, requestedItems: OrderItemInput[]) {
  const products = await transaction.product.findMany({
    where: { id: { in: requestedItems.map((item) => item.productId) } },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));

  const orderItems = requestedItems.map((item) => {
    const product = productsById.get(item.productId);

    if (!product) {
      throw new ValidationError('Uno de los productos seleccionados ya no existe');
    }

    return { productId: product.id, quantity: item.quantity, unitPrice: product.price };
  });

  await consumeStock(transaction, orderItems, productsById);

  const total = orderItems.reduce((accumulated, item) => accumulated + item.unitPrice * item.quantity, 0);
  return { orderItems, total: roundToCents(total) };
}

async function restoreStock(transaction: TransactionClient, items: StockMovement[]): Promise<void> {
  for (const item of items) {
    await transaction.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}

async function consumeStock(
  transaction: TransactionClient,
  items: StockMovement[],
  productsById: Map<string, { name: string }>,
): Promise<void> {
  for (const item of items) {
    // El filtro por stock garantiza el descuento atomico aun con ventas simultaneas.
    const stockUpdate = await transaction.product.updateMany({
      where: { id: item.productId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });

    if (stockUpdate.count === 0) {
      const product = await transaction.product.findUnique({ where: { id: item.productId } });
      throw new InsufficientStockError(productsById.get(item.productId)?.name ?? item.productId, product?.stock ?? 0);
    }
  }
}

function mergeDuplicatedItems(items: OrderItemInput[]): OrderItemInput[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('La venta debe incluir al menos un producto');
  }

  const quantityByProduct = new Map<string, number>();

  for (const item of items) {
    const productId = requireText(item?.productId, 'producto');
    const quantity = requirePositiveInteger(item?.quantity, 'cantidad');
    quantityByProduct.set(productId, (quantityByProduct.get(productId) ?? 0) + quantity);
  }

  return [...quantityByProduct].map(([productId, quantity]) => ({ productId, quantity }));
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function revalidateSalesViews(): void {
  revalidatePath(SALES_ROUTE);
  revalidatePath(INVENTORY_ROUTE);
  revalidatePath(DASHBOARD_ROUTE);
  revalidatePath(REPORT_ROUTE);
}
