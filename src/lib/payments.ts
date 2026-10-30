import 'server-only';

import { PaymentStatus, type Prisma } from '@prisma/client';

import { getPaidAmount, roundToCents } from './payments-view';

/** Recalcula el estado de pago de una venta con sus cobros no anulados: Pendiente, Parcial o Pagado. */
export async function refreshPaymentStatus(transaction: Prisma.TransactionClient, orderId: string): Promise<void> {
  const order = await transaction.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { total: true, paymentStatus: true, payments: { select: { amount: true, voidedAt: true } } },
  });

  const paid = getPaidAmount(order.payments);
  const status =
    paid >= roundToCents(order.total) ? PaymentStatus.PAID : paid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING;

  if (status !== order.paymentStatus) {
    await transaction.order.update({ where: { id: orderId }, data: { paymentStatus: status } });
  }
}
