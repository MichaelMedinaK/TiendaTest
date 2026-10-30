/** Redondea a centavos para comparar importes sin arrastrar errores de coma flotante. */
export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

interface PaymentLike {
  amount: number;
  voidedAt: Date | null;
}

/** Total cobrado de una venta: los cobros anulados no cuentan. */
export function getPaidAmount(payments: PaymentLike[]): number {
  return roundToCents(
    payments.reduce((accumulated, payment) => (payment.voidedAt ? accumulated : accumulated + payment.amount), 0),
  );
}

/** Saldo por cobrar (nunca negativo). */
export function getBalance(total: number, payments: PaymentLike[]): number {
  return Math.max(0, roundToCents(total - getPaidAmount(payments)));
}
