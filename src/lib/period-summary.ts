import type { OrderWithItems } from '@/actions/orders';

import { getStoreDayKey, toStoreDay } from './format';
import { getPaidByMethod, roundToCents } from './payments-view';

export const SUMMARY_PERIODS = {
  hoy: { label: 'Hoy', from: () => getStoreDayKey(0) },
  semana: { label: 'Semana', from: () => getStoreDayKey(-6) },
  mes: { label: 'Mes', from: () => `${getStoreDayKey(0).slice(0, 8)}01` },
} as const;

export type SummaryPeriod = keyof typeof SUMMARY_PERIODS;

export const DEFAULT_SUMMARY_PERIOD: SummaryPeriod = 'hoy';

export interface PeriodSummaryData {
  /** Dias AAAA-MM-DD (hora de la tienda), inclusive. */
  range: { from: string; to: string };
  cashReceived: number;
  shippingTotal: number;
  shippingCount: number;
  /** Domicilios del periodo sin kilometros: no tienen precio de envio y no suman. */
  withoutKmCount: number;
}

/** Dia de la entrega de un domicilio: la fecha programada (guardada en UTC) o, si no tiene, el dia de la venta. */
function getDeliveryDay(order: OrderWithItems): string {
  return order.scheduledDate ? new Date(order.scheduledDate).toISOString().slice(0, 10) : toStoreDay(new Date(order.createdAt));
}

/** Efectivo recibido (por dia del cobro) y deliverys acumulados (por dia de entrega) de las ventas dadas. */
export function buildPeriodSummary(orders: OrderWithItems[], period: SummaryPeriod): PeriodSummaryData {
  const range = { from: SUMMARY_PERIODS[period].from(), to: getStoreDayKey() };
  const isInPeriod = (day: string) => day >= range.from && day <= range.to;

  const cashPayments = orders
    .flatMap((order) => order.payments)
    .filter((payment) => isInPeriod(toStoreDay(new Date(payment.createdAt))));
  const cashReceived = getPaidByMethod(cashPayments).find(({ method }) => method === 'CASH')?.amount ?? 0;

  // Las canceladas no suman; el domiciliario gana el envio completo.
  const deliveries = orders.filter(
    (order) => order.deliveryMethod === 'DELIVERY' && order.deliveryStatus !== 'CANCELLED' && isInPeriod(getDeliveryDay(order)),
  );
  const shipped = deliveries.filter((order) => order.shippingPrice > 0);

  return {
    range,
    cashReceived,
    shippingTotal: roundToCents(shipped.reduce((accumulated, order) => accumulated + order.shippingPrice, 0)),
    shippingCount: shipped.length,
    withoutKmCount: deliveries.length - shipped.length,
  };
}
