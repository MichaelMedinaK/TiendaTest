import type { MovementType } from '@prisma/client';

import type { OrderWithItems } from '@/actions/orders';
import { toStoreDay } from './format';
import { roundToCents } from './payments-view';
import type { ReportPeriod } from './report-summary';

export function inReportPeriod(date: Date, { from, to }: ReportPeriod): boolean {
  if (!from && !to) return true;
  const day = toStoreDay(date);
  return (!from || day >= from) && (!to || day <= to);
}

interface StockMovement {
  type: MovementType;
  quantity: number;
  createdAt: Date;
}

/** Los movimientos vienen en orden cronologico. Se revierte desde el saldo real, sin truncar negativos. */
export function closingStock(current: number, movements: StockMovement[], { from, to }: ReportPeriod) {
  let stock = current;
  let other = 0;
  let sold = 0;
  for (const [index, movement] of movements.entries()) {
    const day = toStoreDay(movement.createdAt);
    if (to && day > to) {
      stock -= movement.quantity;
    } else if (!from || day >= from) {
      if (movement.type === 'SALE' || movement.type === 'SALE_RETURN') {
        sold -= movement.quantity;
      } else if (!(index === 0 && (movement.type === 'ENTRY' || movement.type === 'TRANSFER_IN'))) {
        // La primera carga del inventario se presenta como stock inicial, no tambien como reposicion.
        other += movement.quantity;
      }
    }
  }
  return { initial: stock - other + sold, other, sold, stock };
}

export interface ReportStockRow extends ReturnType<typeof closingStock> {
  name: string;
  sku: string | null;
  owner: string;
  price: number;
  costPrice: number;
}

type SettlementOrder = Pick<OrderWithItems, 'createdAt' | 'deliveryMethod' | 'deliveryStatus' | 'deliveredAt' | 'shippingPrice' | 'payments'>;

export function buildSettlement(orders: SettlementOrder[], period: ReportPeriod) {
  let cash = 0;
  let transfers = 0;
  let deliveryFees = 0;
  let undatedFees = 0;
  for (const order of orders) {
    for (const payment of order.payments) {
      if (payment.voidedAt || !inReportPeriod(payment.createdAt, period)) continue;
      if (payment.method === 'CASH') cash += payment.amount;
      else transfers += payment.amount;
    }
    if (order.deliveryMethod !== 'DELIVERY' || order.deliveryStatus !== 'DELIVERED') continue;
    if ((!period.from && !period.to) || (order.deliveredAt && inReportPeriod(order.deliveredAt, period))) {
      deliveryFees += order.shippingPrice;
    } else if (!order.deliveredAt && (!period.to || toStoreDay(order.createdAt) <= period.to)) {
      undatedFees += order.shippingPrice;
    }
  }
  return {
    cash: roundToCents(cash), transfers: roundToCents(transfers), deliveryFees: roundToCents(deliveryFees),
    net: roundToCents(cash - deliveryFees), undatedFees: roundToCents(undatedFees),
  };
}

export type Settlement = ReturnType<typeof buildSettlement>;
