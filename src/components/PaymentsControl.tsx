'use client';

import { Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

import type { PaymentMethod } from '@prisma/client';

import type { OrderWithItems } from '@/actions/orders';
import { registerPayment, voidPayment } from '@/actions/payments';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { BADGE_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles';
import { formatCurrency, formatDateTime, formatUserLabel } from '@/lib/format';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_BADGES, PAYMENT_STATUS_LABELS, toSelectOptions } from '@/lib/labels';
import { getBalance, getPaidAmount } from '@/lib/payments-view';

const PAYMENT_METHOD_OPTIONS = toSelectOptions(PAYMENT_METHOD_LABELS);

/** Estado de pago, lo cobrado y el boton que abre el detalle de cobros. */
export function PaymentsSummary({ order, isOpen, onToggle }: { order: OrderWithItems; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={`${BADGE_CLASS} ${PAYMENT_STATUS_BADGES[order.paymentStatus]}`}>
        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
      </span>
      <span className="text-xs text-slate-500">
        Cobrado {formatCurrency(getPaidAmount(order.payments))} de {formatCurrency(order.total)}
      </span>
      <button type="button" aria-expanded={isOpen} className={`${SECONDARY_BUTTON_CLASS} px-2 py-1 text-xs`} onClick={onToggle}>
        <Wallet className="h-3.5 w-3.5" />
        Cobros
      </button>
    </div>
  );
}

/** Resumen de pago con el detalle de cobros desplegable debajo (para tarjetas). */
export function PaymentsControl({ order }: { order: OrderWithItems }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-2">
      <PaymentsSummary order={order} isOpen={isOpen} onToggle={() => setIsOpen((open) => !open)} />
      {isOpen && <PaymentsPanel order={order} />}
    </div>
  );
}

/** Historial de cobros de la venta y formulario para registrar uno nuevo (total o parcial). */
export function PaymentsPanel({ order }: { order: OrderWithItems }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const balance = getBalance(order.total, order.payments);
  const canCollect = balance > 0 && order.deliveryStatus !== 'CANCELLED';

  const handleRegister = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await registerPayment(order.id, {
        amount: String(formData.get('amount') ?? ''),
        method: formData.get('method') as PaymentMethod,
        note: String(formData.get('note') ?? ''),
      });

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      feedback.success('Cobro registrado');
      router.refresh();
    });
  };

  const handleVoid = (event: FormEvent<HTMLFormElement>, paymentId: string) => {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '');
    setErrorMessage(null);

    startTransition(async () => {
      const result = await voidPayment(paymentId, reason);

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      feedback.success('Cobro anulado');
      setVoidingId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
      {order.payments.length === 0 ? (
        <p className="text-slate-500">Todavia no hay cobros registrados.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {order.payments.map((payment) => (
            <li key={payment.id} className="space-y-1 py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={payment.voidedAt ? 'text-slate-400 line-through' : 'font-medium text-slate-900'}>
                  {formatCurrency(payment.amount)} - {PAYMENT_METHOD_LABELS[payment.method]}
                </p>
                <p className="text-xs text-slate-500">
                  {formatUserLabel(payment.receivedBy)} - {formatDateTime(new Date(payment.createdAt))}
                </p>
              </div>
              {payment.note && <p className="text-xs text-slate-500">{payment.note}</p>}
              {payment.voidedAt && <p className="text-xs text-rose-600">Anulado: {payment.voidReason}</p>}

              {!payment.voidedAt &&
                (voidingId === payment.id ? (
                  <form onSubmit={(event) => handleVoid(event, payment.id)} className="flex flex-wrap items-center gap-2">
                    <input
                      name="reason"
                      required
                      maxLength={300}
                      aria-label="Motivo de la anulacion"
                      className={`${INPUT_CLASS} min-w-[12rem] flex-1 py-1.5`}
                      placeholder="Motivo de la anulacion (obligatorio)"
                    />
                    <button type="submit" className={SECONDARY_BUTTON_CLASS} disabled={isPending}>
                      Confirmar
                    </button>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setVoidingId(null)}>
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-600 underline"
                    onClick={() => setVoidingId(payment.id)}
                  >
                    Anular cobro
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      <p className="font-medium text-slate-900">
        Saldo por cobrar: {formatCurrency(balance)}
      </p>

      {canCollect && (
        <form onSubmit={handleRegister} className="space-y-2 border-t border-slate-200 pt-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className={LABEL_CLASS} htmlFor={`amount-${order.id}`}>
                Importe
              </label>
              <input
                id={`amount-${order.id}`}
                name="amount"
                type="number"
                inputMode="decimal"
                min={0.01}
                max={balance}
                step="any"
                required
                defaultValue={balance}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor={`method-${order.id}`}>
                Metodo
              </label>
              <select id={`method-${order.id}`} name="method" defaultValue={order.paymentMethod} className={INPUT_CLASS}>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor={`note-${order.id}`}>
                Nota (opcional)
              </label>
              <input id={`note-${order.id}`} name="note" maxLength={200} className={INPUT_CLASS} />
            </div>
          </div>
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
            {isPending ? 'Guardando...' : 'Registrar cobro'}
          </button>
        </form>
      )}

      {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}
    </div>
  );
}
