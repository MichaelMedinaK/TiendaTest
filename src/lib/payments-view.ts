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

/** Lo cobrado por cada metodo (efectivo, transferencia...), sin contar cobros anulados; omite los metodos sin cobros. */
export function getPaidByMethod<TMethod extends string>(
  payments: (PaymentLike & { method: TMethod })[],
): { method: TMethod; amount: number }[] {
  const totals = new Map<TMethod, number>();

  for (const payment of payments) {
    if (!payment.voidedAt) {
      totals.set(payment.method, (totals.get(payment.method) ?? 0) + payment.amount);
    }
  }

  return [...totals].map(([method, amount]) => ({ method, amount: roundToCents(amount) }));
}

/** Saldo por cobrar (nunca negativo). */
export function getBalance(total: number, payments: PaymentLike[]): number {
  return Math.max(0, roundToCents(total - getPaidAmount(payments)));
}
