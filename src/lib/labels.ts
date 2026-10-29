// Import de solo tipos: evita empaquetar el cliente Prisma en el bundle del navegador.
import type { DeliveryStatus, PaymentMethod, PaymentStatus, Role } from '@prisma/client';

/** Etiquetas en espanol centralizadas para no duplicar textos en cada vista. */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pendiente de pago',
  PAID: 'Pagado',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: 'Pendiente',
  IN_TRANSIT: 'En transito',
  DELIVERED: 'Entregado',
  RETURNED: 'Devuelto',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  STAFF: 'Tendero',
  COURIER: 'Domiciliario',
};

export const PAYMENT_STATUS_BADGES: Record<PaymentStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
};

export const DELIVERY_STATUS_BADGES: Record<DeliveryStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  IN_TRANSIT: 'bg-sky-100 text-sky-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  RETURNED: 'bg-rose-100 text-rose-800',
};

export function toSelectOptions<TKey extends string>(labels: Record<TKey, string>) {
  return (Object.entries(labels) as [TKey, string][]).map(([value, label]) => ({ value, label }));
}
