'use server';

import { executeAction } from '@/lib/action-runner';
import { formatProductLabel, getStoreDayKey } from '@/lib/format';
import { loadSalesReport } from '@/lib/load-sales-report';
import { buildReportPdf } from '@/lib/report-pdf';
import type { ReportPeriod } from '@/lib/report-summary';

export async function prepareSalesReport(owner: string | undefined, period: ReportPeriod) {
  return executeAction('reports.prepareSalesReport', async () => {
    const report = await loadSalesReport(owner, period);
    return {
      scope: report.scopeLabel,
      stock: report.stockRows.map((row) => ({
        label: formatProductLabel(row), owner: report.showSellers ? row.owner : null,
        initial: row.initial, sold: row.sold, other: row.other, stock: row.stock,
      })),
      settlement: report.settlement,
      filename: `reporte-ventas-${getStoreDayKey()}.pdf`,
      pdf: await buildReportPdf(report),
    };
  });
}
