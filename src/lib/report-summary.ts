import { DeliveryStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

import type { OrderWithItems } from '@/actions/orders';
import type { InventoryProduct } from '@/actions/products';

import { LOW_STOCK_THRESHOLD } from './constants';
import { toStoreDay } from './format';
import { getBalance, getPaidAmount, roundToCents } from './payments-view';

export interface ReportPeriod {
  /** Dia AAAA-MM-DD (hora de la tienda), inclusive. */
  from?: string;
  to?: string;
}

export interface SoldProductRow {
  name: string;
  sku: string | null;
  units: number;
  revenue: number;
}

export interface SellerRow {
  sellerId: string;
  name: string | null;
  email: string;
  orders: number;
  sold: number;
  collected: number;
  profit: number;
}

export interface ReportSummary {
  ordersCount: number;
  cancelledCount: number;
  /** Pedidos activos que no llevan productos (solo cobran el delivery). */
  deliveryOnlyCount: number;
  unitsSold: number;
  /** Venta de productos, sin envio. */
  productsRevenue: number;
  productsCost: number;
  shippingRevenue: number;
  /** Productos + envio de los pedidos no cancelados. */
  totalSold: number;
  collectedTotal: number;
  collectedByMethod: Record<PaymentMethod, number>;
  pendingAmount: number;
  averageTicket: number;
  deliveryStatusCounts: Record<DeliveryStatus, number>;
  paymentStatusCounts: Record<PaymentStatus, number>;
  soldProducts: SoldProductRow[];
  sellers: SellerRow[];
  lowStockProducts: InventoryProduct[];
  stockUnits: number;
  stockCost: number;
  stockValue: number;
}

export function filterOrdersByPeriod(orders: OrderWithItems[], { from, to }: ReportPeriod): OrderWithItems[] {
  return orders.filter((order) => {
    const day = toStoreDay(order.createdAt);
    return (!from || day >= from) && (!to || day <= to);
  });
}

const sumBy = <T>(values: T[], pick: (value: T) => number): number =>
  values.reduce((accumulated, value) => accumulated + pick(value), 0);

export function itemsRevenue(order: OrderWithItems): number {
  return sumBy(order.items, (item) => item.unitPrice * item.quantity);
}

export function itemsCost(order: OrderWithItems): number {
  return sumBy(order.items, (item) => item.unitCost * item.quantity);
}

/** Cobrado por metodo: solo cobros vigentes (los anulados no cuentan). */
function collectedByMethod(orders: OrderWithItems[]): Record<PaymentMethod, number> {
  const totals: Record<PaymentMethod, number> = { CASH: 0, TRANSFER: 0 };

  for (const order of orders) {
    for (const payment of order.payments) {
      if (!payment.voidedAt) {
        totals[payment.method] += payment.amount;
      }
    }
  }

  return { CASH: roundToCents(totals.CASH), TRANSFER: roundToCents(totals.TRANSFER) };
}

function countBy<TKey extends string>(keys: TKey[], values: TKey[]): Record<TKey, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>;

  for (const value of values) {
    counts[value] += 1;
  }

  return counts;
}

export function buildReportSummary(orders: OrderWithItems[], products: InventoryProduct[]): ReportSummary {
  const active = orders.filter((order) => order.deliveryStatus !== DeliveryStatus.CANCELLED);

  const productsRevenue = sumBy(active, itemsRevenue);
  const shippingRevenue = sumBy(active, (order) => order.shippingPrice);
  const totalSold = roundToCents(sumBy(active, (order) => order.total));

  const soldByProduct = new Map<string, SoldProductRow>();
  for (const order of active) {
    for (const item of order.items) {
      const row = soldByProduct.get(item.productId) ?? {
        name: item.product.name,
        sku: item.product.sku,
        units: 0,
        revenue: 0,
      };
      row.units += item.quantity;
      row.revenue += item.unitPrice * item.quantity;
      soldByProduct.set(item.productId, row);
    }
  }

  const sellers = new Map<string, SellerRow>();
  for (const order of orders) {
    const row = sellers.get(order.sellerId) ?? {
      sellerId: order.sellerId,
      name: order.seller.name,
      email: order.seller.email,
      orders: 0,
      sold: 0,
      collected: 0,
      profit: 0,
    };
    row.collected += getPaidAmount(order.payments);

    if (order.deliveryStatus !== DeliveryStatus.CANCELLED) {
      row.orders += 1;
      row.sold += order.total;
      row.profit += itemsRevenue(order) - itemsCost(order);
    }

    sellers.set(order.sellerId, row);
  }

  return {
    ordersCount: active.length,
    cancelledCount: orders.length - active.length,
    deliveryOnlyCount: active.filter((order) => order.items.length === 0).length,
    unitsSold: sumBy(active, (order) => sumBy(order.items, (item) => item.quantity)),
    productsRevenue: roundToCents(productsRevenue),
    productsCost: roundToCents(sumBy(active, itemsCost)),
    shippingRevenue: roundToCents(shippingRevenue),
    totalSold,
    collectedTotal: roundToCents(sumBy(orders, (order) => getPaidAmount(order.payments))),
    collectedByMethod: collectedByMethod(orders),
    pendingAmount: roundToCents(sumBy(active, (order) => getBalance(order.total, order.payments))),
    averageTicket: active.length > 0 ? roundToCents(totalSold / active.length) : 0,
    deliveryStatusCounts: countBy(
      Object.values(DeliveryStatus),
      orders.map((order) => order.deliveryStatus),
    ),
    paymentStatusCounts: countBy(
      Object.values(PaymentStatus),
      active.map((order) => order.paymentStatus),
    ),
    soldProducts: [...soldByProduct.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units),
    sellers: [...sellers.values()].sort((a, b) => b.sold - a.sold),
    lowStockProducts: products.filter((product) => product.stock <= LOW_STOCK_THRESHOLD),
    // Un stock negativo (vendido sin stock) no suma valor ni unidades.
    stockUnits: sumBy(products, (product) => Math.max(product.stock, 0)),
    stockCost: roundToCents(sumBy(products, (product) => Math.max(product.stock, 0) * product.costPrice)),
    stockValue: roundToCents(sumBy(products, (product) => Math.max(product.stock, 0) * product.price)),
  };
}
