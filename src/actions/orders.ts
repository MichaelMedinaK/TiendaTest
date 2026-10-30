'use server';

import { randomUUID } from 'node:crypto';

import { DeliveryMethod, DeliveryStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { OPEN_DELIVERY_STATUSES } from '@/lib/constants';
import { calculateShippingPrice } from '@/lib/shipping';
import { InsufficientStockError, OrderNotFoundError, ValidationError } from '@/lib/errors';
import { applyStockChange } from '@/lib/inventory-movements';
import { assertOwnsInventory, resolveActingOwnerId, resolveOwnerFilter } from '@/lib/inventory-scope';
import type { SessionPayload } from '@/lib/jwt';
import { assertCanHandleOrder, canHandleAnyOrder } from '@/lib/order-access';
import { ORDER_WITH_ITEMS } from '@/lib/order-include';
import { refreshPaymentStatus } from '@/lib/payments';
import { INVENTORY_ROLES } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requireRole, requireSession } from '@/lib/session';
import {
  optionalIsoDate,
  optionalNonNegativeNumber,
  optionalTime,
  requireEnumValue,
  requirePositiveInteger,
  requireText,
} from '@/lib/validation';

const SALES_ROUTE = '/admin/ventas';
const INVENTORY_ROUTE = '/admin/inventario';
const DASHBOARD_ROUTE = '/admin/dashboard';
const REPORT_ROUTE = '/admin/reporte';
const DELIVERIES_ROUTE = '/admin/entregas';

export interface OrderItemInput {
  productId: string;
  quantity: number;
  /** Precio unitario de esta venta. Si no se envia se usa el pactado (al editar) o el actual del producto. */
  unitPrice?: string | number;
}

interface ParsedOrderItem {
  productId: string;
  quantity: number;
  unitPrice?: number;
}

export interface OrderInput {
  reference: string;
  /** Solo el administrador: vende desde el inventario de ese usuario. Al editar se ignora (la venta conserva su vendedor). */
  sellerId?: string;
  deliveryMethod: DeliveryMethod;
  address?: string;
  /** Fecha AAAA-MM-DD y horas HH:mm de la entrega o recogida. */
  scheduledDate?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  /** Solo aplica al envio a domicilio. El precio del envio se calcula: kilometros x tarifa por km. */
  distanceKm?: string | number;
  paymentMethod: PaymentMethod;
  /** Solo al registrar: si ya se cobro todo, se crea el cobro por el total con el metodo indicado. */
  isPaid?: boolean;
  deliveryStatus: DeliveryStatus;
  items: OrderItemInput[];
}

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof ORDER_WITH_ITEMS }>;

type TransactionClient = Prisma.TransactionClient;
type StockMovement = { productId: string; quantity: number };

/**
 * Ventas visibles para el usuario: el administrador ve todas (o las de un vendedor si pasa su id); un tendero,
 * solo las suyas.
 */
export async function getOrders(seller?: string): Promise<ActionResult<OrderWithItems[]>> {
  return executeAction('orders.getOrders', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);
    const { ownerId } = resolveOwnerFilter(session, seller, true);

    const orders = await prisma.order.findMany({
      where: ownerId ? { sellerId: ownerId } : {},
      include: ORDER_WITH_ITEMS,
      orderBy: { createdAt: 'desc' },
    });

    trace.addStep(`ventas-listadas:${orders.length}`);
    return orders;
  });
}

/** Domicilios por atender (envio a domicilio sin entregar), ordenados por horario. Quien no es domiciliario solo ve los suyos. */
export async function getDeliveries(): Promise<ActionResult<OrderWithItems[]>> {
  return executeAction('orders.getDeliveries', async (trace) => {
    const session = await requireSession();

    const deliveries = await prisma.order.findMany({
      where: {
        deliveryMethod: DeliveryMethod.DELIVERY,
        deliveryStatus: { in: OPEN_DELIVERY_STATUSES },
        ...(canHandleAnyOrder(session) ? {} : { sellerId: session.userId }),
      },
      include: ORDER_WITH_ITEMS,
      orderBy: [
        { scheduledDate: { sort: 'asc', nulls: 'last' } },
        { scheduledFrom: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });

    trace.addStep(`domicilios-listados:${deliveries.length}`);
    return deliveries;
  });
}

/**
 * Registra la venta y descuenta el stock dentro de una unica transaccion.
 * El precio unitario se toma del catalogo (nunca del cliente) para evitar manipulacion de totales.
 * Los productos deben pertenecer al inventario del vendedor.
 */
export async function createOrder(input: OrderInput): Promise<ActionResult<OrderWithItems>> {
  return executeAction('orders.createOrder', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);

    const orderData = parseOrderInput(input);
    const sellerId = await resolveActingOwnerId(session, input.sellerId);
    const orderId = randomUUID();
    trace.addStep(`datos-validados:${orderData.items.length}-items`);

    const createdOrder = await prisma.$transaction(async (transaction) => {
      const { orderItems, total } = await buildOrderItems(transaction, orderData.items, sellerId);

      await syncStock(transaction, {
        sellerId,
        userId: session.userId,
        orderId,
        previous: [],
        next: holdsStock(orderData.fields.deliveryStatus) ? orderItems : [],
        returnReason: 'Venta registrada',
        saleReason: 'Venta registrada',
      });

      const orderTotal = withShipping(total, orderData.fields.shippingPrice);
      const isPaid = input.isPaid === true && holdsStock(orderData.fields.deliveryStatus);

      return transaction.order.create({
        data: {
          id: orderId,
          ...orderData.fields,
          sellerId,
          total: orderTotal,
          paymentStatus: isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
          items: { create: orderItems },
          payments: isPaid
            ? {
                create: {
                  amount: orderTotal,
                  method: orderData.fields.paymentMethod,
                  receivedById: session.userId,
                  note: 'Pago completo al registrar la venta',
                },
              }
            : undefined,
        },
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
 * Edita la venta completa. El stock se ajusta solo por la diferencia entre lo que la venta tenia reservado y lo
 * que reserva ahora, de modo que el inventario siempre queda consistente y el historial sin ruido.
 */
export async function updateOrder(orderId: string, input: OrderInput): Promise<ActionResult<OrderWithItems>> {
  return executeAction('orders.updateOrder', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);
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

      assertOwnsInventory(session, currentOrder.sellerId);

      const agreed = {
        prices: new Map(currentOrder.items.map((item) => [item.productId, item.unitPrice])),
        costs: new Map(currentOrder.items.map((item) => [item.productId, item.unitCost])),
      };
      const { orderItems, total } = await buildOrderItems(transaction, orderData.items, currentOrder.sellerId, agreed);

      await syncStock(transaction, {
        sellerId: currentOrder.sellerId,
        userId: session.userId,
        orderId,
        previous: holdsStock(currentOrder.deliveryStatus) ? currentOrder.items : [],
        next: holdsStock(orderData.fields.deliveryStatus) ? orderItems : [],
        returnReason: 'Venta editada: se devuelve lo que ya no se vende',
        saleReason: 'Venta editada',
      });

      await transaction.order.update({
        where: { id: orderId },
        data: {
          ...orderData.fields,
          total: withShipping(total, orderData.fields.shippingPrice),
          items: { deleteMany: {}, create: orderItems },
        },
      });
      // Si cambio el total, el estado de pago se recalcula con los cobros ya registrados.
      await refreshPaymentStatus(transaction, orderId);

      return transaction.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_WITH_ITEMS });
    });

    trace.addStep(`venta-editada:total=${updatedOrder.total}`);

    revalidateSalesViews();
    return updatedOrder;
  });
}

export async function updatePaymentMethod(
  orderId: string,
  paymentMethod: PaymentMethod,
): Promise<ActionResult<OrderWithItems>> {
  return executeAction('orders.updatePaymentMethod', async (trace) => {
    const session = await requireSession();
    trace.setBusinessId(orderId);

    const newPaymentMethod = requireEnumValue(paymentMethod, PaymentMethod, 'metodo de pago');
    await ensureOrderAccess(session, orderId);

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { paymentMethod: newPaymentMethod },
      include: ORDER_WITH_ITEMS,
    });

    trace.addStep(`metodo-pago:${updatedOrder.paymentMethod}`);

    revalidateSalesViews();
    return updatedOrder;
  });
}

export async function updateDeliveryStatus(
  orderId: string,
  deliveryStatus: DeliveryStatus,
): Promise<ActionResult<OrderWithItems>> {
  return executeAction('orders.updateDeliveryStatus', async (trace) => {
    const session = await requireSession();
    trace.setBusinessId(orderId);

    const newDeliveryStatus = requireEnumValue(deliveryStatus, DeliveryStatus, 'estado de envio');

    // Cancelar devuelve el stock; reactivar un pedido cancelado lo vuelve a descontar.
    const updatedOrder = await prisma.$transaction(async (transaction) => {
      const currentOrder = await transaction.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!currentOrder) {
        throw new OrderNotFoundError(orderId);
      }

      assertCanHandleOrder(session, currentOrder.sellerId);

      await syncStock(transaction, {
        sellerId: currentOrder.sellerId,
        userId: session.userId,
        orderId,
        previous: holdsStock(currentOrder.deliveryStatus) ? currentOrder.items : [],
        next: holdsStock(newDeliveryStatus) ? currentOrder.items : [],
        returnReason: 'Pedido cancelado',
        saleReason: 'Pedido reactivado despues de cancelarlo',
      });

      return transaction.order.update({
        where: { id: orderId },
        data: { deliveryStatus: newDeliveryStatus },
        include: ORDER_WITH_ITEMS,
      });
    });

    trace.addStep(`estado-envio:${updatedOrder.deliveryStatus}`);

    revalidateSalesViews();
    return updatedOrder;
  });
}

/** Elimina la venta y devuelve sus unidades al inventario. */
export async function deleteOrder(orderId: string): Promise<ActionResult<void>> {
  return executeAction('orders.deleteOrder', async (trace) => {
    const session = await requireRole(...INVENTORY_ROLES);
    trace.setBusinessId(orderId);

    await prisma.$transaction(async (transaction) => {
      const currentOrder = await transaction.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!currentOrder) {
        throw new OrderNotFoundError(orderId);
      }

      assertOwnsInventory(session, currentOrder.sellerId);

      await syncStock(transaction, {
        sellerId: currentOrder.sellerId,
        userId: session.userId,
        orderId,
        previous: holdsStock(currentOrder.deliveryStatus) ? currentOrder.items : [],
        next: [],
        returnReason: 'Venta eliminada',
        saleReason: 'Venta eliminada',
      });
      await transaction.order.delete({ where: { id: orderId } });
    });

    trace.addStep('venta-eliminada-stock-devuelto');

    revalidateSalesViews();
  });
}

async function ensureOrderAccess(session: SessionPayload, orderId: string): Promise<void> {
  const existingOrder = await prisma.order.findUnique({ where: { id: orderId }, select: { sellerId: true } });

  if (!existingOrder) {
    throw new OrderNotFoundError(orderId);
  }

  if (!canHandleAnyOrder(session)) {
    assertOwnsInventory(session, existingOrder.sellerId);
  }
}

function parseOrderInput(input: OrderInput) {
  const deliveryMethod = requireEnumValue(input.deliveryMethod, DeliveryMethod, 'tipo de entrega');
  const isDelivery = deliveryMethod === DeliveryMethod.DELIVERY;
  const distanceKm = isDelivery ? optionalNonNegativeNumber(input.distanceKm, 'kilometros') : null;

  return {
    fields: {
      reference: requireText(input.reference, 'referencia', 200),
      deliveryMethod,
      // La direccion solo aplica al envio; en recogida se descarta aunque llegue un valor.
      address: isDelivery ? requireText(input.address, 'direccion', 500) : null,
      ...parseSchedule(input),
      distanceKm,
      // El precio lo calcula el servidor (nunca el cliente): kilometros x tarifa, redondeado hacia arriba.
      shippingPrice: calculateShippingPrice(distanceKm ?? 0),
      paymentMethod: requireEnumValue(input.paymentMethod, PaymentMethod, 'metodo de pago'),
      deliveryStatus: requireEnumValue(input.deliveryStatus, DeliveryStatus, 'estado de envio'),
    },
    items: mergeDuplicatedItems(input.items),
  };
}

/** Fecha y rango horario son opcionales, pero si se informan deben ser coherentes entre si. */
function parseSchedule(input: OrderInput) {
  const scheduledDate = optionalIsoDate(input.scheduledDate, 'fecha de entrega');
  const scheduledFrom = optionalTime(input.scheduledFrom, 'hora desde');
  const scheduledTo = optionalTime(input.scheduledTo, 'hora hasta');

  if ((scheduledFrom || scheduledTo) && !scheduledDate) {
    throw new ValidationError('Indica la fecha de entrega para registrar el horario');
  }

  if (Boolean(scheduledFrom) !== Boolean(scheduledTo)) {
    throw new ValidationError('Indica la hora desde y la hora hasta del horario');
  }

  if (scheduledFrom && scheduledTo && scheduledTo <= scheduledFrom) {
    throw new ValidationError('La hora hasta debe ser posterior a la hora desde');
  }

  return { scheduledDate, scheduledFrom, scheduledTo };
}

/** Una venta cancelada no mantiene stock reservado: sus unidades vuelven al inventario. */
function holdsStock(status: DeliveryStatus): boolean {
  return status !== DeliveryStatus.CANCELLED;
}

/**
 * Fija precios y costos de cada linea. El precio es, en orden: el indicado en la venta, el ya pactado (al editar,
 * para que cambiar el inventario no altere ventas existentes) o el actual del inventario del vendedor. El costo
 * sigue la misma regla. Solo se admiten productos que esten en el inventario del vendedor.
 */
async function buildOrderItems(
  transaction: TransactionClient,
  requestedItems: ParsedOrderItem[],
  sellerId: string,
  agreed: { prices: Map<string, number>; costs: Map<string, number> } = { prices: new Map(), costs: new Map() },
) {
  const inventoryItems = await transaction.inventoryItem.findMany({
    where: { ownerId: sellerId, productId: { in: requestedItems.map((item) => item.productId) } },
  });
  const itemsByProduct = new Map(inventoryItems.map((item) => [item.productId, item]));

  const orderItems = requestedItems.map((item) => {
    const inventoryItem = itemsByProduct.get(item.productId);

    if (!inventoryItem) {
      throw new ValidationError('Uno de los productos seleccionados no esta en el inventario de este vendedor');
    }

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? agreed.prices.get(item.productId) ?? inventoryItem.price,
      unitCost: agreed.costs.get(item.productId) ?? inventoryItem.costPrice,
    };
  });

  const total = orderItems.reduce((accumulated, item) => accumulated + item.unitPrice * item.quantity, 0);
  return { orderItems, total: roundToCents(total) };
}

interface StockSync {
  sellerId: string;
  userId: string;
  orderId: string;
  /** Unidades que la venta tenia reservadas antes del cambio. */
  previous: StockMovement[];
  /** Unidades que debe tener reservadas despues del cambio. */
  next: StockMovement[];
  returnReason: string;
  saleReason: string;
}

/**
 * Ajusta el stock solo por la diferencia entre lo reservado antes y despues, por producto: si baja se devuelve
 * al inventario y si sube se descuenta. Cada cambio deja su movimiento con motivo.
 */
async function syncStock(transaction: TransactionClient, sync: StockSync): Promise<void> {
  const deltas = new Map<string, number>();

  for (const item of sync.previous) {
    deltas.set(item.productId, (deltas.get(item.productId) ?? 0) + item.quantity);
  }

  for (const item of sync.next) {
    deltas.set(item.productId, (deltas.get(item.productId) ?? 0) - item.quantity);
  }

  // Primero las devoluciones, para que el stock devuelto ya este disponible al descontar otras lineas.
  const changes = [...deltas].filter(([, delta]) => delta !== 0).sort((first, second) => second[1] - first[1]);

  if (changes.length === 0) {
    return;
  }

  const inventoryItems = await transaction.inventoryItem.findMany({
    where: { ownerId: sync.sellerId, productId: { in: changes.map(([productId]) => productId) } },
    include: { product: { select: { name: true } } },
  });
  const itemsByProduct = new Map(inventoryItems.map((item) => [item.productId, item]));

  for (const [productId, delta] of changes) {
    const inventoryItem = itemsByProduct.get(productId);

    if (!inventoryItem) {
      throw new ValidationError('Uno de los productos de la venta ya no esta en el inventario del vendedor');
    }

    const stock = await applyStockChange(transaction, {
      inventoryItemId: inventoryItem.id,
      delta,
      type: delta > 0 ? 'SALE_RETURN' : 'SALE',
      reason: delta > 0 ? sync.returnReason : sync.saleReason,
      userId: sync.userId,
      orderId: sync.orderId,
    });

    if (stock === null) {
      throw new InsufficientStockError(inventoryItem.product.name, inventoryItem.stock);
    }
  }
}

function mergeDuplicatedItems(items: OrderItemInput[]): ParsedOrderItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('La venta debe incluir al menos un producto');
  }

  // Un mismo producto con precios distintos se mantiene como lineas separadas.
  const mergedItems = new Map<string, ParsedOrderItem>();

  for (const item of items) {
    const productId = requireText(item?.productId, 'producto');
    const quantity = requirePositiveInteger(item?.quantity, 'cantidad');
    const unitPrice = optionalNonNegativeNumber(item?.unitPrice, 'precio') ?? undefined;
    const key = `${productId}|${unitPrice ?? ''}`;
    const existingItem = mergedItems.get(key);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      mergedItems.set(key, { productId, quantity, unitPrice });
    }
  }

  return [...mergedItems.values()];
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** El total de la venta incluye el precio de envio escrito a mano. */
function withShipping(itemsTotal: number, shippingPrice: number): number {
  return roundToCents(itemsTotal + shippingPrice);
}

function revalidateSalesViews(): void {
  revalidatePath(SALES_ROUTE);
  revalidatePath(INVENTORY_ROUTE);
  revalidatePath(DASHBOARD_ROUTE);
  revalidatePath(REPORT_ROUTE);
  revalidatePath(DELIVERIES_ROUTE);
}
