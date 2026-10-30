import type { Prisma } from '@prisma/client';

/** Lo que se carga con cada venta: lineas, vendedor y cobros (incluidos los anulados, para mostrar el historial). */
export const ORDER_WITH_ITEMS = {
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
  seller: { select: { id: true, name: true, email: true } },
  payments: {
    orderBy: { createdAt: 'asc' },
    include: { receivedBy: { select: { name: true, email: true } } },
  },
} satisfies Prisma.OrderInclude;
