'use server';

import { DeliveryStatus, PaymentStatus } from '@prisma/client';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export interface DashboardMetrics {
  totalSalesAmount: number;
  paidOrdersCount: number;
  unpaidOrdersCount: number;
  pendingDeliveriesCount: number;
  lowStockProductsCount: number;
  lowStockThreshold: number;
}

/** Metricas rapidas del panel. Se resuelven en paralelo para una sola ida a base de datos logica. */
export async function getDashboardMetrics(): Promise<ActionResult<DashboardMetrics>> {
  return executeAction('dashboard.getMetrics', async (trace) => {
    await requireRole('ADMIN', 'STAFF');

    const [salesAggregate, paidOrdersCount, unpaidOrdersCount, pendingDeliveriesCount, lowStockProductsCount] =
      await Promise.all([
        prisma.order.aggregate({ _sum: { total: true } }),
        prisma.order.count({ where: { paymentStatus: PaymentStatus.PAID } }),
        prisma.order.count({ where: { paymentStatus: PaymentStatus.PENDING } }),
        prisma.order.count({
          where: { deliveryStatus: { in: [DeliveryStatus.PENDING, DeliveryStatus.IN_TRANSIT] } },
        }),
        prisma.product.count({ where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } } }),
      ]);

    trace.addStep('metricas-calculadas');

    return {
      totalSalesAmount: salesAggregate._sum.total ?? 0,
      paidOrdersCount,
      unpaidOrdersCount,
      pendingDeliveriesCount,
      lowStockProductsCount,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    } satisfies DashboardMetrics;
  });
}
