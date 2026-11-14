import { DeliveryStatus, PaymentStatus } from '@prisma/client';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

import type { OrderWithItems } from '@/actions/orders';

import { LOW_STOCK_THRESHOLD } from './constants';
import {
  formatCurrency,
  formatDateTime,
  formatProductLabel,
  formatSchedule,
  formatUserLabel,
} from './format';
import {
  DELIVERY_METHOD_LABELS,
  DELIVERY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from './labels';
import { getBalance, getPaidAmount } from './payments-view';
import { type ReportPeriod, type ReportSummary } from './report-summary';

export interface ReportPdfInput {
  /** A quien pertenece el reporte ("Todos los inventarios" o el nombre del usuario). */
  scopeLabel: string;
  period: ReportPeriod;
  summary: ReportSummary;
  orders: OrderWithItems[];
  showSellers: boolean;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 9;
const ROW_HEIGHT = 15;

const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.4, 0.44, 0.5);
const ACCENT = rgb(0.1, 0.35, 0.65);
const HEADER_BACKGROUND = rgb(0.9, 0.94, 0.98);
const RULE = rgb(0.85, 0.87, 0.9);

interface Column {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

interface TableRow {
  cells: string[];
  /** Lineas de detalle bajo la fila (por ejemplo los productos del pedido). */
  details?: string[];
}

/** Las fuentes estandar del PDF solo cubren Latin-1: lo demas se reemplaza para no romper la generacion. */
function sanitize(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

class PdfWriter {
  private page!: PDFPage;
  private y = 0;

  constructor(
    readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.addPage();
  }

  private addPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(height: number): void {
    if (this.y - height < MARGIN) {
      this.addPage();
    }
  }

  private fit(text: string, maxWidth: number, size: number, font: PDFFont): string {
    const clean = sanitize(text);

    if (font.widthOfTextAtSize(clean, size) <= maxWidth) {
      return clean;
    }

    let shortened = clean;
    while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) {
      shortened = shortened.slice(0, -1);
    }

    return `${shortened}...`;
  }

  private draw(text: string, x: number, size: number, font: PDFFont, color = INK, maxWidth = CONTENT_WIDTH): void {
    this.page.drawText(this.fit(text, maxWidth, size, font), { x, y: this.y, size, font, color });
  }

  title(text: string, subtitle: string[]): void {
    this.draw(text, MARGIN, 20, this.bold, ACCENT);
    this.y -= 18;
    for (const line of subtitle) {
      this.draw(line, MARGIN, BODY_SIZE, this.font, MUTED);
      this.y -= 12;
    }
    this.y -= 6;
  }

  heading(text: string): void {
    this.ensureSpace(40);
    this.y -= 10;
    this.draw(text, MARGIN, 12, this.bold, ACCENT);
    this.y -= 5;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.8,
      color: RULE,
    });
    this.y -= 14;
  }

  note(text: string): void {
    this.ensureSpace(ROW_HEIGHT);
    this.draw(text, MARGIN, 8, this.font, MUTED);
    this.y -= ROW_HEIGHT;
  }

  /** Pares etiqueta/valor en dos columnas. */
  figures(rows: [label: string, value: string][]): void {
    const columnWidth = CONTENT_WIDTH / 2 - 10;

    for (let index = 0; index < rows.length; index += 2) {
      this.ensureSpace(ROW_HEIGHT);

      rows.slice(index, index + 2).forEach(([label, value], offset) => {
        const x = MARGIN + offset * (columnWidth + 20);
        const valueWidth = this.bold.widthOfTextAtSize(sanitize(value), BODY_SIZE);

        this.draw(label, x, BODY_SIZE, this.font, MUTED, columnWidth - valueWidth - 8);
        this.draw(value, x + columnWidth - valueWidth, BODY_SIZE, this.bold, INK, columnWidth);
      });

      this.y -= ROW_HEIGHT;
    }
  }

  table(columns: Column[], rows: TableRow[], emptyMessage: string): void {
    const drawHeader = () => {
      this.ensureSpace(ROW_HEIGHT * 2);
      this.page.drawRectangle({
        x: MARGIN,
        y: this.y - 4,
        width: CONTENT_WIDTH,
        height: ROW_HEIGHT,
        color: HEADER_BACKGROUND,
      });
      this.drawCells(
        columns,
        columns.map((column) => column.header),
        this.bold,
      );
      this.y -= ROW_HEIGHT;
    };

    drawHeader();

    if (rows.length === 0) {
      this.draw(emptyMessage, MARGIN + 4, BODY_SIZE, this.font, MUTED);
      this.y -= ROW_HEIGHT;
      return;
    }

    for (const row of rows) {
      const details = row.details ?? [];

      // La fila y sus detalles se mantienen juntos; si no caben, la fila pasa a la pagina siguiente.
      if (this.y - ROW_HEIGHT * (1 + details.length) < MARGIN) {
        this.addPage();
        drawHeader();
      }

      this.drawCells(columns, row.cells, this.font);
      this.y -= ROW_HEIGHT;

      for (const detail of details) {
        this.draw(detail, MARGIN + 14, 8, this.font, MUTED, CONTENT_WIDTH - 18);
        this.y -= ROW_HEIGHT - 3;
      }

      this.page.drawLine({
        start: { x: MARGIN, y: this.y + 8 },
        end: { x: PAGE_WIDTH - MARGIN, y: this.y + 8 },
        thickness: 0.4,
        color: RULE,
      });
    }
  }

  private drawCells(columns: Column[], cells: string[], font: PDFFont): void {
    let x = MARGIN;

    columns.forEach((column, index) => {
      const text = this.fit(cells[index] ?? '', column.width - 8, BODY_SIZE, font);
      const textWidth = font.widthOfTextAtSize(text, BODY_SIZE);
      const textX = column.align === 'right' ? x + column.width - 4 - textWidth : x + 4;

      this.page.drawText(text, { x: textX, y: this.y, size: BODY_SIZE, font, color: INK });
      x += column.width;
    });
  }

  addPageNumbers(): void {
    const pages = this.doc.getPages();

    pages.forEach((page, index) => {
      page.drawText(`Pagina ${index + 1} de ${pages.length}`, {
        x: PAGE_WIDTH - MARGIN - 70,
        y: 22,
        size: 8,
        font: this.font,
        color: MUTED,
      });
    });
  }
}

function describePeriod({ from, to }: ReportPeriod): string {
  if (from && to) return `Periodo: del ${from} al ${to}`;
  if (from) return `Periodo: desde el ${from}`;
  if (to) return `Periodo: hasta el ${to}`;
  return 'Periodo: todo el historial';
}

function orderDetails(order: OrderWithItems): string[] {
  const lines = order.items.map(
    (item) =>
      `${item.quantity} x ${formatProductLabel(item.product)} a ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.unitPrice * item.quantity)}`,
  );

  if (order.items.length === 0) {
    lines.push('Solo delivery (sin productos)');
  }

  if (order.shippingPrice > 0) {
    lines.push(`Envio: ${formatCurrency(order.shippingPrice)}`);
  }

  return lines;
}

/** Arma el PDF del reporte de ventas: resumen, cobros por metodo, productos vendidos, pedidos y stock bajo. */
export async function buildReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
  const { summary, orders } = input;
  const doc = await PDFDocument.create();
  doc.setTitle('Reporte de ventas');
  const writer = new PdfWriter(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));

  writer.title('Reporte de ventas', [
    `Reporte de: ${input.scopeLabel}`,
    describePeriod(input.period),
    `Generado el ${formatDateTime(new Date())}`,
  ]);

  writer.heading('Resumen');
  writer.figures([
    ['Pedidos (sin cancelados)', String(summary.ordersCount)],
    ['Pedidos cancelados', String(summary.cancelledCount)],
    ['Total vendido', formatCurrency(summary.totalSold)],
    ['Ticket promedio', formatCurrency(summary.averageTicket)],
    ['Venta de productos', formatCurrency(summary.productsRevenue)],
    ['Delivery cobrado en envios', formatCurrency(summary.shippingRevenue)],
    ['Unidades vendidas', String(summary.unitsSold)],
    ['Pedidos solo delivery', String(summary.deliveryOnlyCount)],
    ['Costo de lo vendido', formatCurrency(summary.productsCost)],
    ['Ganancia (productos, sin envios)', formatCurrency(summary.productsRevenue - summary.productsCost)],
  ]);

  writer.heading('Dinero recogido');
  writer.figures([
    [PAYMENT_METHOD_LABELS.CASH, formatCurrency(summary.collectedByMethod.CASH)],
    [PAYMENT_METHOD_LABELS.TRANSFER, formatCurrency(summary.collectedByMethod.TRANSFER)],
    ['Total recogido', formatCurrency(summary.collectedTotal)],
    ['Por cobrar', formatCurrency(summary.pendingAmount)],
  ]);
  writer.note('Cuenta los cobros vigentes de los pedidos del periodo; los cobros anulados no se incluyen.');

  writer.heading('Estado de los pedidos');
  writer.figures([
    ...Object.values(DeliveryStatus).map((status): [string, string] => [
      `Envio: ${DELIVERY_STATUS_LABELS[status]}`,
      String(summary.deliveryStatusCounts[status]),
    ]),
    ...Object.values(PaymentStatus).map((status): [string, string] => [
      `Pago: ${PAYMENT_STATUS_LABELS[status]}`,
      String(summary.paymentStatusCounts[status]),
    ]),
  ]);

  if (input.showSellers && summary.sellers.length > 0) {
    writer.heading('Resumen por vendedor');
    writer.table(
      [
        { header: 'Vendedor', width: 175 },
        { header: 'Pedidos', width: 55, align: 'right' },
        { header: 'Vendido', width: 95, align: 'right' },
        { header: 'Recogido', width: 95, align: 'right' },
        { header: 'Ganancia', width: 95, align: 'right' },
      ],
      summary.sellers.map((seller) => ({
        cells: [
          formatUserLabel(seller),
          String(seller.orders),
          formatCurrency(seller.sold),
          formatCurrency(seller.collected),
          formatCurrency(seller.profit),
        ],
      })),
      'Sin ventas.',
    );
  }

  writer.heading('Productos vendidos');
  writer.table(
    [
      { header: 'Producto', width: 295 },
      { header: 'Unidades', width: 70, align: 'right' },
      { header: 'Vendido', width: 150, align: 'right' },
    ],
    summary.soldProducts.map((product) => ({
      cells: [formatProductLabel(product), String(product.units), formatCurrency(product.revenue)],
    })),
    'No se vendieron productos en este periodo.',
  );

  writer.heading('Pedidos');
  writer.table(
    [
      { header: 'Fecha', width: 68 },
      { header: 'Referencia', width: 165 },
      { header: 'Entrega', width: 62 },
      { header: 'Total', width: 70, align: 'right' },
      { header: 'Cobrado', width: 70, align: 'right' },
      { header: 'Saldo', width: 80, align: 'right' },
    ],
    orders.map((order) => {
      const cancelled = order.deliveryStatus === DeliveryStatus.CANCELLED;
      const seller = input.showSellers ? ` (${formatUserLabel(order.seller)})` : '';
      const delivery = [
        DELIVERY_METHOD_LABELS[order.deliveryMethod],
        order.address,
        formatSchedule(order),
        DELIVERY_STATUS_LABELS[order.deliveryStatus],
        `Pago: ${PAYMENT_STATUS_LABELS[order.paymentStatus]}`,
      ]
        .filter(Boolean)
        .join(' - ');

      return {
        cells: [
          formatDateTime(order.createdAt),
          `${order.reference}${seller}`,
          cancelled ? 'Cancelado' : DELIVERY_STATUS_LABELS[order.deliveryStatus],
          formatCurrency(order.total),
          formatCurrency(getPaidAmount(order.payments)),
          cancelled ? '-' : formatCurrency(getBalance(order.total, order.payments)),
        ],
        details: [delivery, ...orderDetails(order)],
      };
    }),
    'Sin pedidos en este periodo.',
  );

  writer.heading('Inventario');
  writer.figures([
    ['Unidades en stock', String(summary.stockUnits)],
    ['Stock a precio real', formatCurrency(summary.stockCost)],
    ['Stock a precio de venta', formatCurrency(summary.stockValue)],
  ]);

  if (summary.lowStockProducts.length > 0) {
    writer.note(`Stock bajo (${LOW_STOCK_THRESHOLD} o menos):`);
    writer.table(
      [
        { header: 'Producto', width: 415 },
        { header: 'Stock', width: 100, align: 'right' },
      ],
      summary.lowStockProducts.map((product) => ({ cells: [formatProductLabel(product), String(product.stock)] })),
      '',
    );
  }

  writer.addPageNumbers();

  return doc.save();
}
