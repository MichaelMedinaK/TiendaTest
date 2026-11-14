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
import { calculateShippingPrice, type ShippingRate } from '@/lib/shipping';
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
  /** Precio por unidad que se cobra en esta venta; como texto para poder escribirlo con comodidad. */
  unitPrice: string;
  /** El precio se cambio a mano: solo entonces se envia; si no, manda el del catalogo. */
  hasCustomPrice: boolean;
}

interface OrderFormProps {
  /** Productos de todos los inventarios a los que tiene acceso el usuario; se filtran por vendedor. */
  products: InventoryProduct[];
  /** Tarifa del delivery configurada en el servidor, para mostrar el mismo total mientras se escribe. */
  shippingRate: ShippingRate;
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

/** Duracion por defecto de la ventana de entrega: la hora "hasta" sale 30 minutos despues de la "desde". */
const DEFAULT_SLOT_MINUTES = 30;
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

/** Suma minutos a una hora "HH:MM" sin pasar de medianoche (el rango horario es de un mismo dia). */
function addMinutesToTime(time: string, minutes: number): string | null {
  const match = /^(\d{2}):(\d{2})/.exec(time);

  if (!match) {
    return null;
  }

  const total = Math.min(Number(match[1]) * 60 + Number(match[2]) + minutes, LAST_MINUTE_OF_DAY);

  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const createEmptyLine = (products: InventoryProduct[]): OrderLine => ({
  productId: products[0]?.id ?? '',
  quantity: 1,
  unitPrice: String(products[0]?.price ?? ''),
  hasCustomPrice: false,
});

/** Al editar, una linea solo queda como precio manual si no coincide con el precio actual del catalogo. */
const createLinesFromOrder = (order: OrderWithItems, products: InventoryProduct[]): OrderLine[] => {
  const inventoryPrices = new Map(
    products.filter((product) => product.ownerId === order.sellerId).map((product) => [product.id, product.price]),
  );

  return order.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: String(item.unitPrice),
    hasCustomPrice: inventoryPrices.get(item.productId) !== item.unitPrice,
  }));
};

export function OrderForm({ products, shippingRate, order, sellers = [], currentUserId, onFinished }: OrderFormProps) {
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
    order ? createLinesFromOrder(order, products) : [createEmptyLine(sellerProducts)],
  );
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(order?.deliveryMethod ?? DEFAULT_DELIVERY_METHOD);
  const [distanceKm, setDistanceKm] = useState<string>(order?.distanceKm != null ? String(order.distanceKm) : '');
  const [scheduledFrom, setScheduledFrom] = useState(order?.scheduledFrom ?? '');
  const [scheduledTo, setScheduledTo] = useState(order?.scheduledTo ?? '');
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
  const shippingAmount = isDelivery ? calculateShippingPrice(Number(distanceKm) || 0, shippingRate) : 0;
  const estimatedTotal = itemsTotal + shippingAmount;

  const updateLine = (index: number, changes: Partial<OrderLine>) => {
    setLines((currentLines) =>
      currentLines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...changes } : line)),
    );
  };

  const removeLine = (index: number) => {
    setLines((currentLines) => currentLines.filter((_, lineIndex) => lineIndex !== index));
  };

  const handleScheduledFromChange = (nextFrom: string) => {
    const suggestedTo = addMinutesToTime(nextFrom, DEFAULT_SLOT_MINUTES);
    const previousSuggestedTo = addMinutesToTime(scheduledFrom, DEFAULT_SLOT_MINUTES);

    // "Hasta" se ajusta mientras siga siendo el sugerido o ya no quede despues de "desde"; si se edito a mano, se respeta.
    if (suggestedTo && (!scheduledTo || scheduledTo === previousSuggestedTo || scheduledTo <= nextFrom)) {
      setScheduledTo(suggestedTo);
    }

    setScheduledFrom(nextFrom);
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
        // Sin precio manual no se envia ninguno: el servidor cobra el del catalogo.
        .map(({ productId, quantity, unitPrice, hasCustomPrice }) => ({
          productId,
          quantity,
          unitPrice: hasCustomPrice ? unitPrice : undefined,
        })),
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
        setScheduledFrom('');
        setScheduledTo('');
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

        {/* Oculto (no desmontado) para conservar lo escrito si se vuelve a elegir envio. */}
        <div className={isDelivery ? '' : 'hidden'}>
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
            placeholder="Direccion o zona de entrega"
          />
        </div>

        <div className={isDelivery ? '' : 'hidden'}>
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
            value={distanceKm}
            onChange={(event) => setDistanceKm(event.target.value)}
            className={INPUT_CLASS}
            placeholder="Ej. 12.5"
          />
          <button
            type="button"
            className={`${SECONDARY_BUTTON_CLASS} mt-2`}
            disabled={isQuoting}
            onClick={handleQuoteDistance}
          >
            <Route className="h-4 w-4" />
            {isQuoting ? 'Calculando...' : 'Calcular km desde la direccion'}
          </button>
        </div>

        <div className={isDelivery ? '' : 'hidden'}>
          <label className={LABEL_CLASS} htmlFor="shippingPrice">
            Precio de envio (automatico)
          </label>
          <input
            id="shippingPrice"
            type="text"
            readOnly
            disabled={!isDelivery}
            value={formatCurrency(shippingAmount)}
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-slate-500">
            {distanceKm || 0} km x {formatCurrency(shippingRate.ratePerKm)} por km, redondeado hacia arriba (minimo{' '}
            {formatCurrency(shippingRate.minPrice)})
          </p>
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
              value={scheduledFrom}
              onChange={(event) => handleScheduledFromChange(event.target.value)}
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
              value={scheduledTo}
              onChange={(event) => setScheduledTo(event.target.value)}
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

        {lines.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500">
            Pedido sin productos: se registra igual y no mueve stock.
            {isDelivery && ' Indica los kilometros para cobrar el delivery.'}
          </p>
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
                    hasCustomPrice: false,
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
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
                    <label className="block text-xs font-medium text-slate-500" htmlFor={`unit-price-${index}`}>
                      Precio unitario
                    </label>
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-600 underline"
                      onClick={() =>
                        updateLine(index, {
                          hasCustomPrice: !line.hasCustomPrice,
                          unitPrice:
                            line.hasCustomPrice && selectedProduct
                              ? String(defaultPriceOf(selectedProduct))
                              : line.unitPrice,
                        })
                      }
                    >
                      {line.hasCustomPrice ? 'Usar el del catalogo' : 'Cambiar precio'}
                    </button>
                  </div>
                  <input
                    id={`unit-price-${index}`}
                    aria-label={`Precio ${index + 1}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    required={line.hasCustomPrice}
                    readOnly={!line.hasCustomPrice}
                    className={`${INPUT_CLASS} ${line.hasCustomPrice ? '' : 'bg-slate-100'}`}
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
                    className={INPUT_CLASS}
                    value={line.quantity}
                    onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                  />
                </div>

                <button
                  type="button"
                  aria-label={`Quitar producto ${index + 1}`}
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => removeLine(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Subtotal ({line.quantity} x {formatCurrency(Number(line.unitPrice) || 0)}):{' '}
                <strong className="font-semibold text-slate-900">
                  {formatCurrency((Number(line.unitPrice) || 0) * line.quantity)}
                </strong>
              </p>

              {availableStock !== undefined && line.quantity > availableStock && (
                <p className="text-xs font-medium text-amber-600">
                  Hay {Math.max(availableStock, 0)} en stock: la venta se registra igual y el stock quedara en{' '}
                  {availableStock - line.quantity} hasta que repongas mercancia.
                </p>
              )}

              {differsFromCatalog && selectedProduct && (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  Precio actual del producto: {formatCurrency(selectedProduct.price)}
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
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
            {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Registrar venta'}
          </button>
        </div>
      </div>
    </form>
  );
}
