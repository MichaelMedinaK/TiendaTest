import type { Cell, CellObject, Column } from 'write-excel-file/universal';

import type { OrderWithItems } from '@/actions/orders';
import { formatDateTime, formatProductLabel, formatUserLabel, getStoreDayKey, toStoreDay } from '@/lib/format';
import {
  DELIVERY_METHOD_LABELS,
  DELIVERY_STATUS_LABELS,
  ORDER_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/lib/labels';
import { getBalance, getPaidAmount, getPaidByMethod } from '@/lib/payments-view';

const MONEY_FORMAT = '#,##0.00';
const DATE_TIME_FORMAT = 'dd/mm/yyyy hh:mm';
const DATE_FORMAT = 'dd/mm/yyyy';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type ItemRow = { order: OrderWithItems; item: OrderWithItems['items'][number] };

/** Excel no maneja zonas horarias: se escribe la hora de la tienda como si fuera UTC para que se vea igual que en la app. */
function toStoreWallClock(date: Date): Date {
  const [, time] = formatDateTime(date).split(' ');
  return new Date(`${toStoreDay(date)}T${time}:00Z`);
}

const header = (value: string): CellObject => ({ value, fontWeight: 'bold', backgroundColor: '#E4E4E7' });
const text = (value: string | null | undefined): Cell => (value ? { value, type: String } : null);
const money = (value: number): CellObject => ({ value, type: Number, format: MONEY_FORMAT });

function formatPaymentMethods(order: OrderWithItems): string {
  const paidByMethod = getPaidByMethod(order.payments);

  return paidByMethod.length === 0
    ? PAYMENT_METHOD_LABELS[order.paymentMethod]
    : paidByMethod.map(({ method }) => PAYMENT_METHOD_LABELS[method]).join(', ');
}

function buildOrderColumns(includeSeller: boolean): Column<OrderWithItems>[] {
  const columns: (Column<OrderWithItems> | null)[] = [
    { header: header('Referencia'), width: 14, cell: (order) => text(order.reference) },
    {
      header: header('Fecha'),
      width: 17,
      cell: (order) => ({ value: toStoreWallClock(order.createdAt), type: Date, format: DATE_TIME_FORMAT }),
    },
    includeSeller ? { header: header('Vendedor'), width: 20, cell: (order) => text(formatUserLabel(order.seller)) } : null,
    { header: header('Tipo'), width: 10, cell: (order) => text(ORDER_KIND_LABELS[order.kind]) },
    { header: header('Entrega'), width: 19, cell: (order) => text(DELIVERY_METHOD_LABELS[order.deliveryMethod]) },
    { header: header('Direccion'), width: 32, cell: (order) => text(order.address) },
    {
      header: header('Fecha programada'),
      width: 16,
      cell: (order) =>
        order.scheduledDate ? { value: order.scheduledDate, type: Date, format: DATE_FORMAT } : null,
    },
    {
      header: header('Horario'),
      width: 14,
      cell: (order) =>
        text(order.scheduledFrom && order.scheduledTo ? `${order.scheduledFrom} - ${order.scheduledTo}` : null),
    },
    {
      header: header('Km'),
      width: 8,
      cell: (order) => (order.distanceKm !== null ? { value: order.distanceKm, type: Number, format: '0.0' } : null),
    },
    {
      header: header('Productos'),
      width: 40,
      cell: (order) =>
        text(order.items.map((item) => `${item.quantity}x ${formatProductLabel(item.product)}`).join('; ')),
    },
    { header: header('Envio'), width: 11, cell: (order) => money(order.shippingPrice) },
    { header: header('Monto tramite'), width: 14, cell: (order) => money(order.extraAmount) },
    { header: header('Total'), width: 12, cell: (order) => ({ ...money(order.total), fontWeight: 'bold' }) },
    { header: header('Cobrado'), width: 12, cell: (order) => money(getPaidAmount(order.payments)) },
    { header: header('Saldo'), width: 12, cell: (order) => money(getBalance(order.total, order.payments)) },
    { header: header('Estado de pago'), width: 18, cell: (order) => text(PAYMENT_STATUS_LABELS[order.paymentStatus]) },
    { header: header('Metodo de pago'), width: 22, cell: (order) => text(formatPaymentMethods(order)) },
    { header: header('Estado de envio'), width: 15, cell: (order) => text(DELIVERY_STATUS_LABELS[order.deliveryStatus]) },
  ];

  return columns.filter((column): column is Column<OrderWithItems> => column !== null);
}

function buildItemColumns(includeSeller: boolean): Column<ItemRow>[] {
  const columns: (Column<ItemRow> | null)[] = [
    { header: header('Referencia'), width: 14, cell: ({ order }) => text(order.reference) },
    {
      header: header('Fecha'),
      width: 17,
      cell: ({ order }) => ({ value: toStoreWallClock(order.createdAt), type: Date, format: DATE_TIME_FORMAT }),
    },
    includeSeller ? { header: header('Vendedor'), width: 20, cell: ({ order }) => text(formatUserLabel(order.seller)) } : null,
    { header: header('Producto'), width: 32, cell: ({ item }) => text(item.product.name) },
    { header: header('SKU'), width: 14, cell: ({ item }) => text(item.product.sku) },
    { header: header('Cantidad'), width: 10, cell: ({ item }) => ({ value: item.quantity, type: Number }) },
    { header: header('Precio unitario'), width: 15, cell: ({ item }) => money(item.unitPrice) },
    { header: header('Subtotal'), width: 12, cell: ({ item }) => money(item.quantity * item.unitPrice) },
    { header: header('Estado de envio'), width: 15, cell: ({ order }) => text(DELIVERY_STATUS_LABELS[order.deliveryStatus]) },
  ];

  return columns.filter((column): column is Column<ItemRow> => column !== null);
}

/** Descarga un .xlsx con las ventas recibidas: hoja "Ventas" (una fila por venta) y "Productos" (una por linea). */
export async function downloadOrdersExcel(orders: OrderWithItems[], { includeSeller }: { includeSeller: boolean }) {
  // Carga diferida: la libreria solo se descarga al exportar.
  const { default: writeXlsxFile, getSheetData } = await import('write-excel-file/universal');

  const orderColumns = buildOrderColumns(includeSeller);
  const itemColumns = buildItemColumns(includeSeller);
  const itemRows: ItemRow[] = orders.flatMap((order) => order.items.map((item) => ({ order, item })));

  const blob = await writeXlsxFile([
    { sheet: 'Ventas', data: getSheetData(orders, orderColumns), columns: orderColumns, stickyRowsCount: 1 },
    { sheet: 'Productos', data: getSheetData(itemRows, itemColumns), columns: itemColumns, stickyRowsCount: 1 },
  ]).toBlob();

  const url = URL.createObjectURL(new Blob([blob], { type: XLSX_MIME }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `ventas-${getStoreDayKey()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Se libera despues para no cortar la descarga en navegadores que la inician de forma asincrona.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
