'use client';

import { ArrowRightLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

import type { InventoryProduct } from '@/actions/products';
import { type TransferPartner, transferStock } from '@/actions/transfers';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { formatCurrency, formatProductLabel, formatUserLabel } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';

interface TransferPanelProps {
  products: InventoryProduct[];
  partners: TransferPartner[];
}

/** Pasa stock del inventario propio al de un revendedor (o de vuelta al tendero), con su costo si es un revendedor propio. */
export function TransferPanel({ products, partners }: TransferPanelProps) {
  const router = useRouter();
  const toast = useFeedback();
  const [toUserId, setToUserId] = useState(partners[0]?.id ?? '');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const partner = partners.find((candidate) => candidate.id === toUserId);
  const product = products.find((candidate) => candidate.id === productId);
  const canSetCost = partner?.role === 'RESELLER' && partner.relation !== 'SUPPLIER';

  if (products.length === 0 || partners.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <FeedbackMessage
          tone="error"
          message={
            partners.length === 0
              ? 'No tienes revendedores ni tendero asignado. El administrador los asigna en Usuarios'
              : 'Primero agrega productos con stock a tu inventario'
          }
        />
      </div>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await transferStock({
        toUserId,
        productId,
        quantity: Number(formData.get('quantity')),
        note: String(formData.get('note') ?? ''),
        costPrice: canSetCost ? String(formData.get('costPrice') ?? '') : null,
      });

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      form.reset();
      toast.success(`Transferido. Te quedan ${result.data.fromStock} de "${product?.name ?? 'producto'}"`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} space-y-4`}>
      <h2 className="text-lg font-semibold text-slate-900">Transferir stock</h2>
      <p className="text-sm text-slate-500">
        Sale de tu inventario y entra al del destinatario; ambos movimientos quedan en el historial.
      </p>

      <div className="grid gap-4 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label className={LABEL_CLASS} htmlFor="transfer-to">
            Destinatario
          </label>
          <select id="transfer-to" className={INPUT_CLASS} value={toUserId} onChange={(event) => setToUserId(event.target.value)}>
            {partners.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {formatUserLabel(candidate)} ({candidate.relation === 'SUPPLIER' ? 'mi tendero' : ROLE_LABELS[candidate.role]})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label className={LABEL_CLASS} htmlFor="transfer-product">
            Producto
          </label>
          <select
            id="transfer-product"
            className={INPUT_CLASS}
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            {products.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {formatProductLabel(candidate)} (hay {candidate.stock})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="transfer-quantity">
            Cantidad
          </label>
          <input
            id="transfer-quantity"
            name="quantity"
            type="number"
            min={1}
            step={1}
            max={Math.max(product?.stock ?? 1, 1)}
            required
            className={INPUT_CLASS}
          />
        </div>

        {canSetCost && (
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS} htmlFor="transfer-cost">
              Costo por unidad para el revendedor
            </label>
            <input
              id="transfer-cost"
              name="costPrice"
              type="number"
              min={0}
              step="any"
              className={INPUT_CLASS}
              placeholder={product ? `Tu precio: ${formatCurrency(product.price)}` : ''}
            />
            <p className="mt-1 text-xs text-slate-500">Vacio: se mantiene el costo que ya tiene.</p>
          </div>
        )}

        <div className={canSetCost ? 'sm:col-span-2' : 'sm:col-span-4'}>
          <label className={LABEL_CLASS} htmlFor="transfer-note">
            Nota (opcional)
          </label>
          <input id="transfer-note" name="note" maxLength={300} className={INPUT_CLASS} placeholder="Ej. Pedido del lunes" />
        </div>
      </div>

      {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}

      <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
        <ArrowRightLeft className="h-4 w-4" />
        {isPending ? 'Transfiriendo...' : 'Transferir'}
      </button>
    </form>
  );
}
