'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState, useTransition } from 'react';

import type { DeliveryStatus, PaymentMethod, PaymentStatus, Product } from '@prisma/client';

import { type OrderWithItems, createOrder, updateOrder } from '@/actions/orders';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import {
  CARD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/ui/styles';
import { formatCurrency } from '@/lib/format';
import {
  DELIVERY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  toSelectOptions,
} from '@/lib/labels';

interface OrderLine {
  productId: string;
  quantity: number;
}

interface OrderFormProps {
  products: Product[];
  /** Si se recibe, el formulario edita esa venta; si no, registra una nueva. */
  order?: OrderWithItems;
  onFinished?: () => void;
}

const PAYMENT_METHOD_OPTIONS = toSelectOptions(PAYMENT_METHOD_LABELS);
const PAYMENT_STATUS_OPTIONS = toSelectOptions(PAYMENT_STATUS_LABELS);
const DELIVERY_STATUS_OPTIONS = toSelectOptions(DELIVERY_STATUS_LABELS);

const createEmptyLine = (products: Product[]): OrderLine => ({
  productId: products[0]?.id ?? '',
  quantity: 1,
});

export function OrderForm({ products, order, onFinished }: OrderFormProps) {
  const router = useRouter();
  const isEditing = Boolean(order);
  const [lines, setLines] = useState<OrderLine[]>(
    order ? order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) : [createEmptyLine(products)],
  );
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  // Al editar, las unidades que la venta ya tiene reservadas vuelven a estar disponibles para ella.
  const reservedByProduct = useMemo(
    () => new Map(order?.items.map((item) => [item.productId, item.quantity]) ?? []),
    [order],
  );

  const estimatedTotal = lines.reduce((accumulated, line) => {
    const product = productsById.get(line.productId);
    return accumulated + (product ? product.price * line.quantity : 0);
  }, 0);

  const updateLine = (index: number, changes: Partial<OrderLine>) => {
    setLines((currentLines) =>
      currentLines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...changes } : line)),
    );
  };

  const removeLine = (index: number) => {
    setLines((currentLines) => currentLines.filter((_, lineIndex) => lineIndex !== index));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setFeedback(null);

    const input = {
      description: String(formData.get('description') ?? ''),
      reference: String(formData.get('reference') ?? ''),
      address: String(formData.get('address') ?? ''),
      paymentMethod: formData.get('paymentMethod') as PaymentMethod,
      paymentStatus: formData.get('paymentStatus') as PaymentStatus,
      deliveryStatus: formData.get('deliveryStatus') as DeliveryStatus,
      items: lines.filter((line) => line.productId),
    };

    startTransition(async () => {
      const result = order ? await updateOrder(order.id, input) : await createOrder(input);

      if (!result.success) {
        setFeedback({ tone: 'error', message: result.error });
        return;
      }

      if (!order) {
        form.reset();
        setLines([createEmptyLine(products)]);
        setFeedback({ tone: 'success', message: `Venta registrada por ${formatCurrency(result.data.total)}` });
      }

      router.refresh();
      onFinished?.();
    });
  };

  if (products.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <FeedbackMessage tone="error" message="Registra productos en el inventario antes de vender" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} space-y-4`}>
      <h2 className="text-lg font-semibold text-slate-900">{isEditing ? 'Editar venta' : 'Registrar nueva venta'}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="description">
            Descripcion
          </label>
          <input
            id="description"
            name="description"
            required
            maxLength={500}
            defaultValue={order?.description}
            className={INPUT_CLASS}
            placeholder="Ej. Pedido de Maria - 2 camisetas"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="reference">
            Referencia
          </label>
          <input
            id="reference"
            name="reference"
            maxLength={100}
            defaultValue={order?.reference ?? ''}
            className={INPUT_CLASS}
            placeholder="Codigo de operacion o nota"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="address">
            Direccion (parte)
          </label>
          <input
            id="address"
            name="address"
            maxLength={500}
            defaultValue={order?.address ?? ''}
            className={INPUT_CLASS}
            placeholder="Distrito o zona de entrega"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="paymentMethod">
            Metodo de pago
          </label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            className={INPUT_CLASS}
            defaultValue={order?.paymentMethod ?? 'CASH'}
          >
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="paymentStatus">
            Estado del pago
          </label>
          <select
            id="paymentStatus"
            name="paymentStatus"
            className={INPUT_CLASS}
            defaultValue={order?.paymentStatus ?? 'PENDING'}
          >
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="deliveryStatus">
            Estado del envio
          </label>
          <select
            id="deliveryStatus"
            name="deliveryStatus"
            className={INPUT_CLASS}
            defaultValue={order?.deliveryStatus ?? 'PENDING'}
          >
            {DELIVERY_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <p className={LABEL_CLASS}>Productos del stock</p>

        {lines.map((line, index) => {
          const selectedProduct = productsById.get(line.productId);
          const availableStock = selectedProduct
            ? selectedProduct.stock + (reservedByProduct.get(selectedProduct.id) ?? 0)
            : undefined;

          return (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <select
                  aria-label={`Producto ${index + 1}`}
                  className={INPUT_CLASS}
                  value={line.productId}
                  onChange={(event) => updateLine(index, { productId: event.target.value })}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({formatCurrency(product.price)}) - stock{' '}
                      {product.stock + (reservedByProduct.get(product.id) ?? 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-24">
                <input
                  aria-label={`Cantidad ${index + 1}`}
                  type="number"
                  min={1}
                  max={availableStock}
                  className={INPUT_CLASS}
                  value={line.quantity}
                  onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                />
              </div>

              {lines.length > 1 && (
                <button
                  type="button"
                  aria-label={`Quitar producto ${index + 1}`}
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => removeLine(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => setLines((currentLines) => [...currentLines, createEmptyLine(products)])}
        >
          <Plus className="h-4 w-4" />
          Agregar producto
        </button>
      </div>

      {feedback && <FeedbackMessage tone={feedback.tone} message={feedback.message} />}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <p className="text-sm text-slate-600">
          Total estimado: <span className="font-bold text-slate-900">{formatCurrency(estimatedTotal)}</span>
        </p>
        <div className="flex gap-2">
          {isEditing && (
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onFinished} disabled={isPending}>
              Cancelar
            </button>
          )}
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
            {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Registrar venta'}
          </button>
        </div>
      </div>
    </form>
  );
}
