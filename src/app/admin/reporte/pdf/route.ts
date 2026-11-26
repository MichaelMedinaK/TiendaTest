import { NextRequest, NextResponse } from 'next/server';

import { ForbiddenError, InactiveUserError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { getStoreDayKey } from '@/lib/format';
import { loadSalesReport } from '@/lib/load-sales-report';
import { buildReportPdf } from '@/lib/report-pdf';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    const report = await loadSalesReport(params.get('duenio') || undefined, {
      from: params.get('desde') || undefined, to: params.get('hasta') || undefined,
    });
    const pdf = await buildReportPdf(report);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="reporte-ventas-${getStoreDayKey()}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError || error instanceof InactiveUserError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
