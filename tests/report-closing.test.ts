import assert from 'node:assert/strict';
import test from 'node:test';
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from 'pdf-lib';

import type { OrderWithItems } from '../src/actions/orders';
import { formatCurrency } from '../src/lib/format';
import { buildSettlement, closingStock } from '../src/lib/report-closing';
import { buildReportPdf } from '../src/lib/report-pdf';
import { buildReportSummary, filterOrdersByPeriod } from '../src/lib/report-summary';

const first = new Date('2026-06-01T15:00Z');
const second = new Date('2026-06-02T15:00Z');
const third = new Date('2026-06-03T15:00Z');
const period = { from: '2026-06-02', to: '2026-06-02' };

test('el cierre historico reconstruye el stock sin descontar dos veces la venta ni perder devoluciones', () => {
  const movements: Parameters<typeof closingStock>[1] = [
    { type: 'ENTRY', quantity: 12, createdAt: first },
    { type: 'SALE', quantity: -4, createdAt: first },
    { type: 'TRANSFER_IN', quantity: 3, createdAt: second },
    { type: 'SALE', quantity: -15, createdAt: second },
    { type: 'SALE_RETURN', quantity: 2, createdAt: second },
    { type: 'ENTRY', quantity: 9, createdAt: third },
  ];
  assert.deepEqual(closingStock(7, movements, period), { initial: 8, other: 3, sold: 13, stock: -2 });
  assert.deepEqual(closingStock(7, movements, {}), { initial: 12, other: 12, sold: 17, stock: 7 });
});

const seller = { id: 'v', name: 'Vendedora', email: 'v@example.invalid' };
const sale: OrderWithItems = {
  id: 'a', sellerId: 'v', seller, reference: 'Pedido A', kind: 'SALE', deliveryMethod: 'DELIVERY',
  deliveryStatus: 'DELIVERED', deliveredAt: second, address: 'Calle 1', scheduledDate: null, scheduledFrom: null,
  scheduledTo: null, distanceKm: 1, shippingPrice: 5, extraAmount: 0, paymentMethod: 'TRANSFER', paymentStatus: 'PAID',
  total: 100, createdAt: first, items: [], payments: [],
};

function payment(amount: number, method: 'CASH' | 'TRANSFER', createdAt: Date, voidedAt: Date | null = null): OrderWithItems['payments'][number] {
  return { id: 'p', orderId: 'a', amount, method, createdAt, voidedAt, receivedById: seller.id, receivedBy: seller,
    voidReason: null, voidedById: null, note: null };
}

test('100 en efectivo de una venta anterior menos dos envios de 5, incluso uno pagado por transferencia', () => {
  const orders: OrderWithItems[] = [
    { ...sale, payments: [payment(100, 'CASH', second), payment(20, 'CASH', second, third)] },
    { ...sale, id: 'b', createdAt: second, payments: [payment(35, 'TRANSFER', second), payment(1, 'CASH', third)] },
    { ...sale, deliveredAt: third, payments: [payment(20, 'CASH', first)] },
    { ...sale, deliveryMethod: 'PICKUP' }, { ...sale, deliveryStatus: 'IN_TRANSIT' }, { ...sale, deliveryStatus: 'CANCELLED' },
  ];
  assert.deepEqual(filterOrdersByPeriod(orders, period).map((order) => order.id), ['b']);
  assert.deepEqual(buildSettlement(orders, period), { cash: 100, transfers: 35, deliveryFees: 10, net: 90, undatedFees: 0 });
});

test('el envio antiguo sin fecha entra en Todo y no se inventa una fecha en un cierre historico', () => {
  const orders = [{ ...sale, deliveredAt: null }];
  assert.deepEqual(buildSettlement(orders, period), { cash: 0, transfers: 0, deliveryFees: 0, net: 0, undatedFees: 5 });
  assert.deepEqual(buildSettlement(orders, {}), { cash: 0, transfers: 0, deliveryFees: 5, net: -5, undatedFees: 0 });
});

test('el PDF conserva la direccion y todos los productos incluso si una venta ocupa varias paginas', async () => {
  const items = Array.from({ length: 90 }, (_, i) => ({
    id: `${i}`, orderId: 'a', productId: `${i}`, quantity: 1, unitPrice: 1, unitCost: 0,
    product: { id: `${i}`, name: `Producto ${i + 1}`, sku: null },
  }));
  const order = { ...sale, items, total: 95, address: `${'Sector norte '.repeat(35)}CASA-FINAL`,
    payments: [payment(95, 'CASH', second)] };
  const stock = [{ name: 'Producto 1', sku: null, owner: 'Vendedora', price: 1, costPrice: 0,
    initial: 8, other: 0, sold: 1, stock: 7 }];
  const pdf = await PDFDocument.load(await buildReportPdf({
    period: {}, orders: [order], stockRows: stock, scopeLabel: 'Vendedora', showSellers: false,
    summary: buildReportSummary([order], stock), settlement: buildSettlement([order], {}),
  }));
  const lines: string[] = [];
  for (const page of pdf.getPages()) {
    const streams = page.node.Contents();
    assert.ok(streams instanceof PDFArray);
    for (const ref of streams.asArray()) {
      const stream = pdf.context.lookup(ref);
      assert.ok(stream instanceof PDFRawStream);
      const content = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
      for (const match of content.matchAll(/<([\da-f]+)> Tj/gi)) lines.push(Buffer.from(match[1], 'hex').toString('latin1'));
      for (const pos of content.matchAll(/1 0 0 1 [\d.-]+ ([\d.-]+) Tm/g)) {
        assert.ok(Number(pos[1]) >= 20 && Number(pos[1]) <= page.getHeight(), 'texto fuera de la pagina');
      }
    }
  }
  const text = lines.join('\n');
  assert.match(text, /Stock inicial y stock esperado al cierre/);
  assert.match(text, /2026-06-01\nPedido A/);
  assert.match(text, /CASA-FINAL/);
  assert.match(text, /1 x Producto 90 a /);
  assert.ok(text.includes(`Efectivo a entregar\n${formatCurrency(90)}`));
});
