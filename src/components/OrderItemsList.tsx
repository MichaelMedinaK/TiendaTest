import { formatCurrency, formatProductLabel } from '@/lib/format';

interface OrderItemView {
  id: string;
  quantity: number;
  unitPrice: number;
  product: { name: string; sku: string | null };
}

/** Detalle de productos de una venta: "cantidad x Producto - SKU", precio unitario y total segun la cantidad. */
export function OrderItemsList({ items, className = 'text-xs' }: { items: OrderItemView[]; className?: string }) {
  return (
    <ul className={`w-full space-y-1.5 text-slate-600 ${className}`}>
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span>
            {item.quantity} x {formatProductLabel(item.product)}
          </span>
          <span className="whitespace-nowrap">
            {formatCurrency(item.unitPrice)} c/u
            <span className="mx-1 text-slate-400">=</span>
            <strong className="font-semibold text-slate-900">{formatCurrency(item.unitPrice * item.quantity)}</strong>
          </span>
        </li>
      ))}
    </ul>
  );
}
