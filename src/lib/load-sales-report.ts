import 'server-only';

import { ValidationError } from './errors';
import { formatUserLabel, toStoreDay } from './format';
import { effectiveCostPrice, effectiveSalePrice } from './inventory-prices';
import { resolveOwnerFilter } from './inventory-scope';
import { ORDER_WITH_ITEMS } from './order-include';
import { INVENTORY_ROLES } from './permissions';
import { prisma } from './prisma';
import { buildSettlement, closingStock } from './report-closing';
import type { ReportPdfInput } from './report-pdf';
import { buildReportSummary, filterOrdersByPeriod, type ReportPeriod } from './report-summary';
import { requireRole } from './session';
import { optionalIsoDate } from './validation';

export async function loadSalesReport(owner: string | undefined, requested: ReportPeriod): Promise<ReportPdfInput> {
  const session = await requireRole(...INVENTORY_ROLES);
  const period = {
    from: optionalIsoDate(requested.from, 'desde')?.toISOString().slice(0, 10),
    to: optionalIsoDate(requested.to, 'hasta')?.toISOString().slice(0, 10),
  };
  if (period.from && period.to && period.from > period.to) {
    throw new ValidationError('La fecha desde no puede ser posterior a la fecha hasta');
  }
  const { ownerId } = resolveOwnerFilter(session, owner, true);
  const [items, allOrders, selectedOwner] = await prisma.$transaction([
    prisma.inventoryItem.findMany({
      where: { ownerId },
      select: {
        stock: true, costPrice: true, salePrice: true, createdAt: true,
        owner: { select: { name: true, email: true, role: true } },
        product: { select: { name: true, sku: true, costPrice: true, price: true } },
        movements: {
          select: { type: true, quantity: true, createdAt: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ product: { name: 'asc' } }, { ownerId: 'asc' }],
    }),
    prisma.order.findMany({ where: { sellerId: ownerId }, include: ORDER_WITH_ITEMS, orderBy: { createdAt: 'desc' } }),
    prisma.user.findUnique({ where: { id: ownerId ?? session.userId }, select: { name: true, email: true } }),
  ], { isolationLevel: 'RepeatableRead' });

  if (!selectedOwner) throw new ValidationError('No se encontro el inventario elegido');
  const stockRows = items
    .filter((item) => !period.to || toStoreDay(item.createdAt) <= period.to)
    .map((item) => ({
      name: item.product.name, sku: item.product.sku, owner: formatUserLabel(item.owner),
      price: effectiveSalePrice(item, item.product), costPrice: effectiveCostPrice(item, item.product, item.owner.role),
      ...closingStock(item.stock, item.movements, period),
    }));
  const orders = filterOrdersByPeriod(allOrders, period);
  return {
    scopeLabel: ownerId ? formatUserLabel(selectedOwner) : 'Todos los inventarios',
    period, orders, stockRows, summary: buildReportSummary(orders, stockRows),
    settlement: buildSettlement(allOrders, period), showSellers: !ownerId,
  };
}
