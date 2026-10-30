import { DeliveryStatus, PaymentStatus } from '@prisma/client';

import { type OrderWithItems, getOrders } from '@/actions/orders';
import { getInventoryOwners, getProducts } from '@/actions/products';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { OrderItemsList } from '@/components/OrderItemsList';
import { OwnerSelect } from '@/components/OwnerSelect';
import {
  CARD_CLASS,
  TABLE_CELL_CLASS,
  TABLE_CLASS,
  TABLE_HEAD_CELL_CLASS,
} from '@/components/ui/styles';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import {
  formatCurrency,
  formatDateTime,
  formatProductLabel,
  formatSchedule,
  formatShipping,
  formatUserLabel,
} from '@/lib/format';
import {
  DELIVERY_METHOD_LABELS,
  DELIVERY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/lib/labels';
import { getCurrentSession } from '@/lib/session';
import { getBalance, getPaidAmount } from '@/lib/payments-view';

import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ searchParams }: { searchParams?: Promise<{ duenio?: string }> }) {
  const { duenio } = (await searchParams) ?? {};
  const session = await getCurrentSession();
  const isAdmin = session?.role === 'ADMIN';
  // El administrador ve todos los inventarios por defecto o filtra por uno; un tendero solo ve el suyo.
  const selectedOwner = isAdmin ? duenio || 'ALL' : undefined;

  const [productsResult, ordersResult, ownersResult] = await Promise.all([
    getProducts(selectedOwner ?? 'ALL'),
    getOrders(selectedOwner),
    getInventoryOwners(),
  ]);

  if (!productsResult.success) {
    return <FeedbackMessage tone="error" message={productsResult.error} />;
  }

  if (!ordersResult.success) {
    return <FeedbackMessage tone="error" message={ordersResult.error} />;
  }

  if (!ownersResult.success) {
    return <FeedbackMessage tone="error" message={ownersResult.error} />;
  }

  const products = productsResult.data;
  const orders = ordersResult.data;
  const owners = ownersResult.data;
  const ownerLabels = new Map(owners.map((owner) => [owner.id, formatUserLabel(owner)]));

  const totalSales = sumTotals(orders);
  // Lo cobrado sale de los cobros registrados (no anulados); lo pendiente, del saldo de las ventas no canceladas.
  const collectedAmount = orders.reduce((accumulated, order) => accumulated + getPaidAmount(order.payments), 0);
  const pendingAmount = orders
    .filter((order) => order.deliveryStatus !== DeliveryStatus.CANCELLED)
    .reduce((accumulated, order) => accumulated + getBalance(order.total, order.payments), 0);
  const stockUnits = products.reduce((accumulated, product) => accumulated + product.stock, 0);
  const stockValue = products.reduce((accumulated, product) => accumulated + product.stock * product.price, 0);
  const stockCost = products.reduce((accumulated, product) => accumulated + product.stock * product.costPrice, 0);
  const lowStockProducts = products.filter((product) => product.stock <= LOW_STOCK_THRESHOLD);

  // Las ventas canceladas no generan ganancia.
  const profitableOrders = orders.filter((order) => order.deliveryStatus !== DeliveryStatus.CANCELLED);
  const productsRevenue = profitableOrders.reduce((accumulated, order) => accumulated + itemsRevenue(order), 0);
  const productsCost = profitableOrders.reduce((accumulated, order) => accumulated + itemsCost(order), 0);

  const summary = [
    { label: 'Ventas registradas', value: String(orders.length) },
    { label: 'Total vendido', value: formatCurrency(totalSales) },
    { label: 'Cobrado', value: formatCurrency(collectedAmount) },
    { label: 'Por cobrar', value: formatCurrency(pendingAmount) },
    { label: 'Costo de lo vendido', value: formatCurrency(productsCost) },
    { label: 'Ganancia (sin envios ni cancelados)', value: formatCurrency(productsRevenue - productsCost) },
    { label: 'Unidades en stock', value: String(stockUnits) },
    { label: 'Stock a precio real', value: formatCurrency(stockCost) },
    { label: 'Stock a precio de venta', value: formatCurrency(stockValue) },
  ];

  const sellerRows = owners
    .map((owner) => {
      const ownerOrders = profitableOrders.filter((order) => order.sellerId === owner.id);
      const revenue = ownerOrders.reduce((accumulated, order) => accumulated + itemsRevenue(order), 0);
      const cost = ownerOrders.reduce((accumulated, order) => accumulated + itemsCost(order), 0);

      return { owner, salesCount: ownerOrders.length, revenue, cost };
    })
    .filter((row) => row.salesCount > 0);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reporte de la tienda</h1>
          <p className="text-sm text-slate-500">Generado el {formatDateTime(new Date())}</p>
        </div>
        <PrintButton />
      </header>

      {isAdmin && <OwnerSelect owners={owners} value={selectedOwner ?? 'ALL'} includeAll label="Reporte de" />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map((item) => (
          <article key={item.label} className={CARD_CLASS}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{item.value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className={CARD_CLASS}>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Estado de los envios</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {Object.values(DeliveryStatus).map((status) => (
              <li key={status} className="flex justify-between">
                <span>{DELIVERY_STATUS_LABELS[status]}</span>
                <span className="font-semibold">{orders.filter((order) => order.deliveryStatus === status).length}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className={CARD_CLASS}>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Estado de los pagos</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {Object.values(PaymentStatus).map((status) => (
              <li key={status} className="flex justify-between">
                <span>{PAYMENT_STATUS_LABELS[status]}</span>
                <span className="font-semibold">{orders.filter((order) => order.paymentStatus === status).length}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      {isAdmin && sellerRows.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Resumen por vendedor</h2>
          <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
            <table className={TABLE_CLASS}>
              <thead className="bg-slate-50">
                <tr>
                  <th className={TABLE_HEAD_CELL_CLASS}>Vendedor</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Ventas</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Vendido</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Costo</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Ganancia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sellerRows.map(({ owner, salesCount, revenue, cost }) => (
                  <tr key={owner.id}>
                    <td className={TABLE_CELL_CLASS}>{formatUserLabel(owner)}</td>
                    <td className={TABLE_CELL_CLASS}>{salesCount}</td>
                    <td className={TABLE_CELL_CLASS}>{formatCurrency(revenue)}</td>
                    <td className={TABLE_CELL_CLASS}>{formatCurrency(cost)}</td>
                    <td className={`${TABLE_CELL_CLASS} font-semibold`}>{formatCurrency(revenue - cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Stock actual</h2>
        {lowStockProducts.length > 0 && (
          <p className="text-sm text-rose-600">
            Stock bajo ({LOW_STOCK_THRESHOLD} o menos): {lowStockProducts.map((product) => formatProductLabel(product)).join(', ')}
          </p>
        )}
        <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
          <table className={TABLE_CLASS}>
            <thead className="bg-slate-50">
              <tr>
                <th className={TABLE_HEAD_CELL_CLASS}>Producto - SKU</th>
                {isAdmin && <th className={TABLE_HEAD_CELL_CLASS}>Inventario</th>}
                <th className={TABLE_HEAD_CELL_CLASS}>Precio real</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Precio de venta</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.inventoryItemId}>
                  <td className={TABLE_CELL_CLASS}>{formatProductLabel(product)}</td>
                  {isAdmin && (
                    <td className={TABLE_CELL_CLASS}>
                      {ownerLabels.get(product.ownerId) ?? '-'}
                    </td>
                  )}
                  <td className={TABLE_CELL_CLASS}>{formatCurrency(product.costPrice)}</td>
                  <td className={TABLE_CELL_CLASS}>{formatCurrency(product.price)}</td>
                  <td className={TABLE_CELL_CLASS}>{product.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Pedidos</h2>
        <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
          <table className={TABLE_CLASS}>
            <thead className="bg-slate-50">
              <tr>
                <th className={TABLE_HEAD_CELL_CLASS}>Fecha</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Referencia</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Entrega</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Pago</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Envio</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Total</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Ganancia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className={`${TABLE_CELL_CLASS} whitespace-nowrap`}>{formatDateTime(order.createdAt)}</td>
                  <td className={TABLE_CELL_CLASS}>
                    {order.reference}
                    {isAdmin && (
                      <span className="block text-xs text-slate-500">Vendedor: {formatUserLabel(order.seller)}</span>
                    )}
                    <div className="mt-1 w-full max-w-md">
                      <OrderItemsList items={order.items} />
                    </div>
                  </td>
                  <td className={TABLE_CELL_CLASS}>
                    {DELIVERY_METHOD_LABELS[order.deliveryMethod]}
                    {order.address ? ` - ${order.address}` : ''}
                    {formatSchedule(order) && <span className="block text-xs text-slate-500">{formatSchedule(order)}</span>}
                    {formatShipping(order) && <span className="block text-xs text-slate-500">{formatShipping(order)}</span>}
                  </td>
                  <td className={TABLE_CELL_CLASS}>
                    {PAYMENT_METHOD_LABELS[order.paymentMethod]} - {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  </td>
                  <td className={TABLE_CELL_CLASS}>{DELIVERY_STATUS_LABELS[order.deliveryStatus]}</td>
                  <td className={`${TABLE_CELL_CLASS} font-semibold`}>{formatCurrency(order.total)}</td>
                  <td className={TABLE_CELL_CLASS}>
                    {order.deliveryStatus === DeliveryStatus.CANCELLED
                      ? '-'
                      : formatCurrency(itemsRevenue(order) - itemsCost(order))}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className={`${TABLE_CELL_CLASS} text-slate-500`}>
                    Sin ventas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function sumTotals(orders: { total: number }[]): number {
  return orders.reduce((accumulated, order) => accumulated + order.total, 0);
}

/** Venta de productos (sin envio). */
function itemsRevenue(order: OrderWithItems): number {
  return order.items.reduce((accumulated, item) => accumulated + item.unitPrice * item.quantity, 0);
}

/** Costo de los productos de la venta, con el costo registrado al venderlos. */
function itemsCost(order: OrderWithItems): number {
  return order.items.reduce((accumulated, item) => accumulated + item.unitCost * item.quantity, 0);
}
