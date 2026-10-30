'use client';

import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, History, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, type ReactNode, useEffect, useState, useTransition } from 'react';

import {
  type InventoryProduct,
  type MovementView,
  getMovements,
  registerMovement,
  updateInventoryPrices,
} from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import {
  BADGE_CLASS,
  CARD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  STACKED_CELL_CLASS,
  STACKED_EDIT_CELL_CLASS,
  STACKED_EDIT_ROW_CLASS,
  STACKED_GROUP_ACTIVE_CLASS,
  STACKED_GROUP_CLASS,
  STACKED_HEAD_CLASS,
  STACKED_ROW_CLASS,
  STACKED_TABLE_CLASS,
  STACKED_TITLE_CELL_CLASS,
  STACKED_WRAPPER_CLASS,
  TABLE_HEAD_CELL_CLASS,
} from '@/components/ui/styles';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { formatCurrency, formatDateTime, formatProductLabel } from '@/lib/format';
import { MOVEMENT_TYPE_LABELS } from '@/lib/labels';

const COLUMN_COUNT = 2;

type Panel = 'ENTRY' | 'EXIT' | 'PRICES' | 'HISTORY';

export function InventoryTable({ products }: { products: InventoryProduct[] }) {
  if (products.length === 0) {
    return <div className={`${CARD_CLASS} text-sm text-slate-500`}>Todavia no hay productos en este inventario.</div>;
  }

  return (
    <div className={STACKED_WRAPPER_CLASS}>
      <table className={STACKED_TABLE_CLASS}>
        <thead className={STACKED_HEAD_CLASS}>
          <tr>
            <th className={TABLE_HEAD_CELL_CLASS}>Producto - SKU</th>
            <th className={TABLE_HEAD_CELL_CLASS}>Precio de venta</th>
          </tr>
        </thead>
        {products.map((product) => (
          <ProductRow key={product.inventoryItemId} product={product} />
        ))}
      </table>
    </div>
  );
}

function ProductRow({ product }: { product: InventoryProduct }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);

  const isLowStock = product.stock <= LOW_STOCK_THRESHOLD;
  const togglePanel = (next: Panel) => setPanel((current) => (current === next ? null : next));
  const closePanel = () => setPanel(null);

  return (
    <tbody className={`${STACKED_GROUP_CLASS} ${isExpanded ? STACKED_GROUP_ACTIVE_CLASS : ''}`}>
      <tr className={`${STACKED_ROW_CLASS} cursor-pointer`} onClick={() => setIsExpanded((expanded) => !expanded)}>
        <td data-label="Producto" className={STACKED_TITLE_CELL_CLASS}>
          <button type="button" aria-expanded={isExpanded} className="flex w-full items-center gap-2 text-left">
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${isExpanded ? 'rotate-180' : ''}`} />
            {formatProductLabel(product)}
          </button>
        </td>
        <td data-label="Precio de venta" className={STACKED_CELL_CLASS}>{formatCurrency(product.price)}</td>
      </tr>

      {isExpanded && (
        <tr className={STACKED_EDIT_ROW_CLASS}>
          <td colSpan={COLUMN_COUNT} className={STACKED_EDIT_CELL_CLASS}>
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Detail label="Precio real">{formatCurrency(product.costPrice)}</Detail>
                <Detail label="Precio de venta">{formatCurrency(product.price)}</Detail>
                <Detail label="Margen">{formatCurrency(product.price - product.costPrice)}</Detail>
                <Detail label="Stock">
                  <span
                    className={`${BADGE_CLASS} ${isLowStock ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}
                  >
                    {product.stock} {isLowStock ? '(bajo)' : ''}
                  </span>
                </Detail>
              </dl>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => togglePanel('ENTRY')}>
                  <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                  Entrada
                </button>
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => togglePanel('EXIT')}>
                  <ArrowUpFromLine className="h-4 w-4 text-rose-600" />
                  Salida
                </button>
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => togglePanel('PRICES')}>
                  <Pencil className="h-4 w-4" />
                  Editar precios
                </button>
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => togglePanel('HISTORY')}>
                  <History className="h-4 w-4" />
                  Historial
                </button>
              </div>

              {(panel === 'ENTRY' || panel === 'EXIT') && (
                <MovementForm product={product} type={panel} onFinished={closePanel} />
              )}
              {panel === 'PRICES' && <PricesForm product={product} onFinished={closePanel} />}
              {panel === 'HISTORY' && <HistoryList inventoryItemId={product.inventoryItemId} />}
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function MovementForm({
  product,
  type,
  onFinished,
}: {
  product: InventoryProduct;
  type: 'ENTRY' | 'EXIT';
  onFinished: () => void;
}) {
  const router = useRouter();
  const feedback = useFeedback();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEntry = type === 'ENTRY';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await registerMovement(product.inventoryItemId, {
        type,
        quantity: Number(formData.get('quantity')),
        reason: String(formData.get('reason') ?? ''),
      });

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      feedback.success(`${isEntry ? 'Entrada' : 'Salida'} registrada. "${product.name}" ahora tiene ${result.data.stock}`);
      router.refresh();
      onFinished();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-semibold text-brand-600">
        {isEntry ? 'Entrada' : 'Salida'} de stock: {formatProductLabel(product)} (hay {product.stock})
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className={LABEL_CLASS} htmlFor={`quantity-${product.inventoryItemId}`}>
            Cantidad
          </label>
          <input
            id={`quantity-${product.inventoryItemId}`}
            name="quantity"
            type="number"
            min={1}
            step={1}
            required
            className={INPUT_CLASS}
          />
        </div>
        <div className="sm:col-span-3">
          <label className={LABEL_CLASS} htmlFor={`reason-${product.inventoryItemId}`}>
            Descripcion (obligatoria)
          </label>
          <input
            id={`reason-${product.inventoryItemId}`}
            name="reason"
            required
            maxLength={500}
            className={INPUT_CLASS}
            placeholder={isEntry ? 'Ej. Recibi mercancia de Juan' : 'Ej. Entregue 5 a Pedro'}
          />
        </div>
      </div>

      {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}

      <div className="flex gap-2">
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
          {isPending ? 'Guardando...' : `Registrar ${isEntry ? 'entrada' : 'salida'}`}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onFinished} disabled={isPending}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function PricesForm({ product, onFinished }: { product: InventoryProduct; onFinished: () => void }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await updateInventoryPrices(product.inventoryItemId, {
        costPrice: Number(formData.get('costPrice')),
        price: Number(formData.get('price')),
      });

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      const label = formatProductLabel(result.data);
      const { updatedOrdersCount } = result.data;
      const priceChanged = result.data.price !== product.price;

      feedback.success(
        !priceChanged
          ? `Precios de "${label}" actualizados`
          : updatedOrdersCount > 0
            ? `Precios de "${label}" actualizados. Se recalcularon ${updatedOrdersCount} venta(s) pendiente(s) con el nuevo precio`
            : `Precios de "${label}" actualizados. Ninguna venta pendiente tenia el precio anterior`,
      );
      router.refresh();
      onFinished();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-semibold text-brand-600">Precios: {formatProductLabel(product)}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS} htmlFor={`cost-${product.inventoryItemId}`}>
            Precio real (costo)
          </label>
          <input
            id={`cost-${product.inventoryItemId}`}
            name="costPrice"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            required
            defaultValue={product.costPrice}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor={`price-${product.inventoryItemId}`}>
            Precio de venta
          </label>
          <input
            id={`price-${product.inventoryItemId}`}
            name="price"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            required
            defaultValue={product.price}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}

      <div className="flex gap-2">
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar precios'}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onFinished} disabled={isPending}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function HistoryList({ inventoryItemId }: { inventoryItemId: string }) {
  const [movements, setMovements] = useState<MovementView[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    getMovements(inventoryItemId).then((result) => {
      if (!isCurrent) {
        return;
      }

      if (result.success) {
        setMovements(result.data);
      } else {
        setErrorMessage(result.error);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [inventoryItemId]);

  if (errorMessage) {
    return <FeedbackMessage tone="error" message={errorMessage} />;
  }

  if (!movements) {
    return <p className="text-sm text-slate-500">Cargando historial...</p>;
  }

  if (movements.length === 0) {
    return <p className="text-sm text-slate-500">Este producto todavia no tiene movimientos.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
      {movements.map((movement) => (
        <li key={movement.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2">
          <div>
            <p className="font-medium text-slate-900">
              {MOVEMENT_TYPE_LABELS[movement.type]}{' '}
              <span className={movement.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {movement.quantity > 0 ? '+' : ''}
                {movement.quantity}
              </span>
            </p>
            <p className="text-xs text-slate-500">{movement.reason}</p>
          </div>
          <p className="text-xs text-slate-500">
            Stock {movement.stockAfter} - {movement.userName} - {formatDateTime(new Date(movement.createdAt))}
          </p>
        </li>
      ))}
    </ul>
  );
}
