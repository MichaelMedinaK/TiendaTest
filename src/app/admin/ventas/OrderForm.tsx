'use client';

import { Plus, Route, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useRef, useState, useTransition } from 'react';

import type { DeliveryMethod, DeliveryStatus, PaymentMethod } from '@prisma/client';

import { quoteDelivery } from '@/actions/delivery-quote';
import { type OrderWithItems, createOrder, updateOrder } from '@/actions/orders';
import type { InventoryOwner, InventoryProduct } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import {
  CARD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/ui/styles';
import { DELIVERY_RATE_PER_KM } from '@/lib/constants';
import { calculateShippingPrice } from '@/lib/shipping';
import { formatCurrency, formatProductLabel, formatUserLabel } from '@/lib/format';
import {
  DELIVERY_METHOD_LABELS,
  DELIVERY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  toSelectOptions,
} from '@/lib/labels';

interface OrderLine {
  productId: string;
  quantity: number;
  /** Precio unitario de esta venta, editable; como texto para poder escribirlo con comodidad. */
  unitPrice: string;
}

interface OrderFormProps {
  /** Productos de todos los inventarios a los que tiene acceso el usuario; se filtran por vendedor. */
  products: InventoryProduct[];
  /** Si se recibe, el formulario edita esa venta; si no, registra una nueva. */
  order?: OrderWithItems;
  /** Al registrar: usuarios desde cuyo inventario se puede vender (el selector aparece si hay mas de uno). */
  sellers?: InventoryOwner[];
  /** Al registrar: vendedor inicial (el usuario en sesion). */
  currentUserId?: string;
  onFinished?: () => void;
}

const DELIVERY_METHOD_OPTIONS = toSelectOptions(DELIVERY_METHOD_LABELS);
const DEFAULT_DELIVERY_METHOD: DeliveryMethod = 'PICKUP';
const PAYMENT_METHOD_OPTIONS = toSelectOptions(PAYMENT_METHOD_LABELS);
const DELIVERY_STATUS_OPTIONS = toSelectOptions(DELIVERY_STATUS_LABELS);

const createEmptyLine = (products: InventoryProduct[]): OrderLine => ({
  productId: products[0]?.id ?? '',
  quantity: 1,
  unitPrice: String(products[0]?.price ?? ''),
});

export function OrderForm({ products, order, sellers = [], currentUserId, onFinished }: OrderFormProps) {
  const router = useRouter();
  const toast = useFeedback();
  const isEditing = Boolean(order);
  // La venta usa solo el inventario de su vendedor; al editar el vendedor no cambia.
  const [sellerId, setSellerId] = useState(order?.sellerId ?? currentUserId ?? '');
  const sellerProducts = useMemo(
    () => (sellerId ? products.filter((product) => product.ownerId === sellerId) : products),
    [products, sellerId],
  );
  const [lines, setLines] = useState<OrderLine[]>(
    order
      ? order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice),
        }))
      : [createEmptyLine(sellerProducts)],
  );
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(order?.deliveryMethod ?? DEFAULT_DELIVERY_METHOD);
  const [distanceKm, setDistanceKm] = useState<string>(order?.distanceKm != null ? String(order.distanceKm) : '');
  const [isPaid, setIsPaid] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isQuoting, startQuoting] = useTransition();
  const addressRef = useRef<HTMLInputElement>(null);
  const isDelivery = deliveryMethod === 'DELIVERY';

  const productsById = useMemo(() => new Map(sellerProducts.map((product) => [product.id, product])), [sellerProducts]);

  // Al editar, las unidades que la venta ya tiene reservadas vuelven a estar disponibles para ella (una cancelada no reserva).
  const reservedByProduct = useMemo(
    () =>
      new Map(
        order && order.deliveryStatus !== 'CANCELLED' ? order.items.map((item) => [item.productId, item.quantity]) : [],
      ),
    [order],
  );

  // Al editar, un producto que la venta ya tenia conserva el precio con el que se vendio (hasta que se cambie a mano).
  const agreedPriceByProduct = useMemo(
    () => new Map(order?.items.map((item) => [item.productId, item.unitPrice]) ?? []),
    [order],
  );
  const defaultPriceOf = (product: InventoryProduct) => agreedPriceByProduct.get(product.id) ?? product.price;

  const itemsTotal = lines.reduce((accumulated, line) => accumulated + (Number(line.unitPrice) || 0) * line.quantity, 0);
  // Mismo calculo que el servidor (km x tarifa); el servidor es quien fija el valor definitivo.
  const shippingAmount = isDelivery ? calculateShippingPrice(Number(distanceKm) || 0) : 0;
  const estimatedTotal = itemsTotal + shippingAmount;

  const updateLine = (index: number, changes: Partial<OrderLine>) => {
    setLines((currentLines) =>
      currentLines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...changes } : line)),
    );
  };

  const removeLine = (index: number) => {
    setLines((currentLines) => currentLines.filter((_, lineIndex) => lineIndex !== index));
  };

  const handleQuoteDistance = () => {
    startQuoting(async () => {
      const result = await quoteDelivery(addressRef.current?.value ?? '');

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setDistanceKm(String(result.data.distanceKm));
      toast.success(`${result.data.distanceKm} km hasta ${result.data.destination}`);
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setFeedback(null);

    const input = {
      reference: String(formData.get('reference') ?? ''),
      sellerId: isEditing ? undefined : sellerId,
      deliveryMethod,
      address: String(formData.get('address') ?? ''),
      scheduledDate: String(formData.get('scheduledDate') ?? ''),
      scheduledFrom: String(formData.get('scheduledFrom') ?? ''),
      scheduledTo: String(formData.get('scheduledTo') ?? ''),
      distanceKm,
      paymentMethod: formData.get('paymentMethod') as PaymentMethod,
      // Al crear solo se indica si ya se cobro todo (se registra el cobro por el total); los cobros parciales se
      // registran despues desde Cobros. El envio siempre parte como nuevo.
      isPaid: isEditing ? undefined : isPaid,
      deliveryStatus: isEditing ? (formData.get('deliveryStatus') as DeliveryStatus) : 'PENDING',
      items: lines
        .filter((line) => line.productId)
        .map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice })),
    };

    startTransition(async () => {
      const result = order ? await updateOrder(order.id, input) : await createOrder(input);

      if (!result.success) {
        setFeedback({ tone: 'error', message: result.error });
        return;
      }

      if (!order) {
        form.reset();
        setDeliveryMethod(DEFAULT_DELIVERY_METHOD);
        setDistanceKm('');
        setIsPaid(false);
        setLines([createEmptyLine(sellerProducts)]);
        toast.success(`Venta registrada por ${formatCurrency(result.data.total)}`);
      } else {
        toast.success('Venta actualizada');
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
        {!isEditing && sellers.length > 1 && (
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS} htmlFor="sellerId">
              Vender desde el inventario de
            </label>
            <select
              id="sellerId"
              className={INPUT_CLASS}
              value={sellerId}
              onChange={(event) => {
                setSellerId(event.target.value);
                setLines([createEmptyLine(products.filter((product) => product.ownerId === event.target.value))]);
              }}
            >
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {formatUserLabel(seller)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="reference">
            Referencia
          </label>
          <input
            id="reference"
            name="reference"
            required
            maxLength={200}
            defaultValue={order?.reference}
            className={INPUT_CLASS}
            placeholder="Ej. Pedido de Maria - codigo de operacion o nota"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="deliveryMethod">
            Tipo de entrega
          </label>
          <select
            id="deliveryMethod"
            name="deliveryMethod"
            className={INPUT_CLASS}
            value={deliveryMethod}
            onChange={(event) => setDeliveryMethod(event.target.value as DeliveryMethod)}
          >
            {DELIVERY_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="address">
            Direccion
          </label>
          <input
            id="address"
            name="address"
            ref={addressRef}
            required={isDelivery}
            disabled={!isDelivery}
            maxLength={500}
            defaultValue={order?.address ?? ''}
            className={INPUT_CLASS}
            placeholder={isDelivery ? 'Direccion o zona de entrega' : 'No aplica para recogida'}
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="distanceKm">
            Kilometros
          </label>
          <input
            id="distanceKm"
            name="distanceKm"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            disabled={!isDelivery}
            value={isDelivery ? distanceKm : ''}
            onChange={(event) => setDistanceKm(event.target.value)}
            className={INPUT_CLASS}
            placeholder={isDelivery ? 'Ej. 12.5' : 'No aplica para recogida'}
          />
          {isDelivery && (
            <button
              type="button"
              className={`${SECONDARY_BUTTON_CLASS} mt-2`}
              disabled={isQuoting}
              onClick={handleQuoteDistance}
            >
              <Route className="h-4 w-4" />
              {isQuoting ? 'Calculando...' : 'Calcular km desde la direccion'}
            </button>
          )}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="shippingPrice">
            Precio de envio (automatico)
          </label>
          <input
            id="shippingPrice"
            type="text"
            readOnly
            disabled={!isDelivery}
            value={isDelivery ? formatCurrency(shippingAmount) : ''}
            className={INPUT_CLASS}
            placeholder={isDelivery ? '' : 'No aplica para recogida'}
          />
          {isDelivery && (
            <p className="mt-1 text-xs text-slate-500">
              {distanceKm || 0} km x {formatCurrency(DELIVERY_RATE_PER_KM)} por km, redondeado hacia arriba
            </p>
          )}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="scheduledDate">
            {isDelivery ? 'Fecha de entrega' : 'Fecha de recogida'}
          </label>
          <input
            id="scheduledDate"
            name="scheduledDate"
            type="date"
            defaultValue={order?.scheduledDate?.toISOString().slice(0, 10) ?? ''}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="scheduledFrom">
              Hora desde
            </label>
            <input
              id="scheduledFrom"
              name="scheduledFrom"
              type="time"
              defaultValue={order?.scheduledFrom ?? ''}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="scheduledTo">
              Hora hasta
            </label>
            <input
              id="scheduledTo"
              name="scheduledTo"
              type="time"
              defaultValue={order?.scheduledTo ?? ''}
              className={INPUT_CLASS}
            />
          </div>
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

        {isEditing ? (
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
            <p className="mt-1 text-xs text-slate-500">Los cobros se registran desde el boton Cobros de la venta.</p>
          </div>
        ) : (
          <div>
            <p className={LABEL_CLASS}>Pago recibido</p>
            <button
              type="button"
              role="switch"
              aria-checked={isPaid}
              aria-label="Ya pagado"
              onClick={() => setIsPaid((paid) => !paid)}
              className={`${INPUT_CLASS} flex items-center justify-between text-left`}
            >
              <span>{isPaid ? 'Ya pagado' : 'Pendiente de pago'}</span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${isPaid ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-neutral-50 shadow transition-all ${
                    isPaid ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className={LABEL_CLASS}>Productos del stock</p>

        {sellerProducts.length === 0 && (
          <FeedbackMessage tone="error" message="Este vendedor no tiene productos en su inventario" />
        )}

        {lines.map((line, index) => {
          const selectedProduct = productsById.get(line.productId);
          const availableStock = selectedProduct
            ? selectedProduct.stock + (reservedByProduct.get(selectedProduct.id) ?? 0)
            : undefined;
          const differsFromCatalog = selectedProduct !== undefined && Number(line.unitPrice) !== selectedProduct.price;

          return (
            <div key={index} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <select
                aria-label={`Producto ${index + 1}`}
                className={INPUT_CLASS}
                value={line.productId}
                onChange={(event) => {
                  const nextProduct = productsById.get(event.target.value);
                  updateLine(index, {
                    productId: event.target.value,
                    unitPrice: nextProduct ? String(defaultPriceOf(nextProduct)) : '',
                  });
                }}
              >
                {sellerProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {formatProductLabel(product)} ({formatCurrency(product.price)}) - stock{' '}
                    {product.stock + (reservedByProduct.get(product.id) ?? 0)}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[8rem] flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor={`unit-price-${index}`}>
                    Precio unitario
                  </label>
                  <input
                    id={`unit-price-${index}`}
                    aria-label={`Precio ${index + 1}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    required
                    className={INPUT_CLASS}
                    value={line.unitPrice}
                    onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                  />
                </div>

                <div className="w-24">
                  <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor={`quantity-${index}`}>
                    Cantidad
                  </label>
                  <input
                    id={`quantity-${index}`}
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

              <p className="text-xs text-slate-500">
                Subtotal ({line.quantity} x {formatCurrency(Number(line.unitPrice) || 0)}):{' '}
                <strong className="font-semibold text-slate-900">
                  {formatCurrency((Number(line.unitPrice) || 0) * line.quantity)}
                </strong>
              </p>

              {differsFromCatalog && selectedProduct && (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  Precio actual del producto: {formatCurrency(selectedProduct.price)}
                  <button
                    type="button"
                    className="font-semibold text-brand-600 underline"
                    onClick={() => updateLine(index, { unitPrice: String(selectedProduct.price) })}
                  >
                    Usar precio actual
                  </button>
                </p>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => setLines((currentLines) => [...currentLines, createEmptyLine(sellerProducts)])}
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
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending || sellerProducts.length === 0}>
            {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Registrar venta'}
          </button>
        </div>
      </div>
    </form>
  );
}
