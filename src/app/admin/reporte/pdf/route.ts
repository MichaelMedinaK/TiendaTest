import { NextRequest, NextResponse } from 'next/server';

import { getOrders } from '@/actions/orders';
import { getInventoryOwners, getProducts } from '@/actions/products';
import { formatUserLabel, getStoreDayKey } from '@/lib/format';
import { buildReportPdf } from '@/lib/report-pdf';
import { buildReportSummary, filterOrdersByPeriod } from '@/lib/report-summary';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const readDay = (value: string | null): string | undefined => (value && DAY_PATTERN.test(value) ? value : undefined);

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * PDF del reporte de ventas. Cada usuario obtiene el de sus propios pedidos y productos; el administrador puede
 * elegir un usuario (`duenio`) o ver todos. `desde` y `hasta` (AAAA-MM-DD) acotan el periodo.
 */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();

  if (!session) {
    return fail('Sesion no valida', 401);
  }

  const params = request.nextUrl.searchParams;
  const selectedOwner = session.role === 'ADMIN' ? params.get('duenio') || 'ALL' : undefined;
  const period = { from: readDay(params.get('desde')), to: readDay(params.get('hasta')) };

  // Las acciones validan la sesion contra la base de datos y limitan cada rol a su propio inventario.
  const [productsResult, ordersResult, ownersResult] = await Promise.all([
    getProducts(selectedOwner ?? 'ALL'),
    getOrders(selectedOwner),
    getInventoryOwners(),
  ]);

  if (!productsResult.success) return fail(productsResult.error, 403);
  if (!ordersResult.success) return fail(ordersResult.error, 403);
  if (!ownersResult.success) return fail(ownersResult.error, 403);

  const orders = filterOrdersByPeriod(ordersResult.data, period);
  const scopeOwner = ownersResult.data.find((owner) => owner.id === (selectedOwner ?? session.userId));
  const scopeLabel = selectedOwner === 'ALL' ? 'Todos los inventarios' : scopeOwner ? formatUserLabel(scopeOwner) : '-';

  const pdf = await buildReportPdf({
    scopeLabel,
    period,
    summary: buildReportSummary(orders, productsResult.data),
    orders,
    showSellers: selectedOwner === 'ALL',
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-ventas-${getStoreDayKey()}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
