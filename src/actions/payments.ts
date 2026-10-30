'use server';

import { DeliveryStatus, PaymentMethod } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { OrderNotFoundError, ValidationError } from '@/lib/errors';
import { assertCanHandleOrder } from '@/lib/order-access';
import { ORDER_WITH_ITEMS } from '@/lib/order-include';
import { refreshPaymentStatus } from '@/lib/payments';
import { getBalance, roundToCents } from '@/lib/payments-view';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { optionalText, requireEnumValue, requirePositiveNumber, requireText } from '@/lib/validation';

import type { OrderWithItems } from './orders';

const PAYMENT_VIEWS = ['/admin/ventas', '/admin/dashboard', '/admin/entregas', '/admin/reporte'];

export interface PaymentInput {
  amount: number | string;
  method: PaymentMethod;
  note?: string;
}

function revalidatePaymentViews(): void {
  for (const route of PAYMENT_VIEWS) {
    revalidatePath(route);
  }
}

/**
 * Registra un cobro de la venta (puede ser parcial y en varios metodos). Quien lo recibe queda registrado.
 * Lo puede hacer el vendedor de la venta, el administrador o un domiciliario.
 */
export async function registerPayment(orderId: string, input: PaymentInput): Promise<ActionResult<OrderWithItems>> {
  return executeAction('payments.register', async (trace) => {
    const session = await requireSession();
    trace.setBusinessId(orderId);

    const amount = roundToCents(requirePositiveNumber(input.amount, 'importe'));
    const method = requireEnumValue(input.method, PaymentMethod, 'metodo de pago');
    const note = optionalText(input.note, 200);

    const order = await prisma.$transaction(async (transaction) => {
      const current = await transaction.order.findUnique({ where: { id: orderId }, include: { payments: true } });

      if (!current) {
        throw new OrderNotFoundError(orderId);
      }

      assertCanHandleOrder(session, current.sellerId);

      if (current.deliveryStatus === DeliveryStatus.CANCELLED) {
        throw new ValidationError('No se puede registrar un cobro en un pedido cancelado');
      }

      const balance = getBalance(current.total, current.payments);

      if (amount > balance) {
        throw new ValidationError(`El cobro supera el saldo pendiente de la venta (${balance})`);
      }

      await transaction.payment.create({
        data: { orderId, amount, method, receivedById: session.userId, note },
      });
      await refreshPaymentStatus(transaction, orderId);

      return transaction.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_WITH_ITEMS });
    });

    trace.addStep(`cobro-registrado:${amount}:${method}`);
    revalidatePaymentViews();

    return order;
  });
}

/** Anula un cobro registrado por error. Queda en el historial con su motivo y deja de contar para el saldo. */
export async function voidPayment(paymentId: string, reason: string): Promise<ActionResult<OrderWithItems>> {
  return executeAction('payments.void', async (trace) => {
    const session = await requireSession();
    trace.setBusinessId(paymentId);

    const voidReason = requireText(reason, 'motivo', 300);

    const order = await prisma.$transaction(async (transaction) => {
      const payment = await transaction.payment.findUnique({
        where: { id: paymentId },
        include: { order: { select: { sellerId: true } } },
      });

      if (!payment) {
        throw new ValidationError('No se encontro el cobro');
      }

      if (payment.voidedAt) {
        throw new ValidationError('El cobro ya esta anulado');
      }

      assertCanHandleOrder(session, payment.order.sellerId);

      await transaction.payment.update({
        where: { id: paymentId },
        data: { voidedAt: new Date(), voidReason, voidedById: session.userId },
      });
      await refreshPaymentStatus(transaction, payment.orderId);

      return transaction.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: ORDER_WITH_ITEMS });
    });

    trace.addStep('cobro-anulado');
    revalidatePaymentViews();

    return order;
  });
}
