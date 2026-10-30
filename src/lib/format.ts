// Node y el navegador usan versiones distintas de ICU: formatear directamente
// con Intl produce separadores diferentes y React reporta errores de hidratacion.
// Por eso solo se toman de Intl los valores numericos y la cadena se arma aqui.
const STORE_TIME_ZONE = process.env.NEXT_PUBLIC_STORE_TIME_ZONE ?? 'America/Lima';
const CURRENCY_SYMBOL = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? 'S/';

const AMOUNT_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: STORE_TIME_ZONE,
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

type DatePartName = 'day' | 'month' | 'year' | 'hour' | 'minute';

export function formatCurrency(amount: number): string {
  return `${CURRENCY_SYMBOL} ${AMOUNT_FORMATTER.format(amount)}`;
}

export function formatDateTime(date: Date): string {
  const parts = DATE_PARTS_FORMATTER.formatToParts(date);
  const partValue = (name: DatePartName) => parts.find((part) => part.type === name)?.value ?? '00';

  return `${partValue('day')}/${partValue('month')}/${partValue('year')} ${partValue('hour')}:${partValue('minute')}`;
}

/** "Producto - SKU" (o solo el nombre si no tiene SKU): forma estandar de listar productos. */
export function formatProductLabel({ name, sku }: { name: string; sku: string | null }): string {
  return sku ? `${name} - ${sku}` : name;
}

/** Nombre del usuario para listas y selectores (cae al usuario de acceso si no tiene nombre). */
export function formatUserLabel({ name, email }: { name: string | null; email: string }): string {
  return name?.trim() || email;
}

interface Schedule {
  scheduledDate: Date | null;
  scheduledFrom: string | null;
  scheduledTo: string | null;
}

/** Solo la fecha ("29/10/26") del horario; la fecha se guarda sin zona horaria (UTC). */
export function formatScheduleDay(scheduledDate: Date): string {
  const isoDate = scheduledDate.toISOString();
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(2, 4)}`;
}

/** Texto del horario ("29/10/26 14:00 - 16:00"), o null si la venta no tiene fecha. */
export function formatSchedule({ scheduledDate, scheduledFrom, scheduledTo }: Schedule): string | null {
  if (!scheduledDate) {
    return null;
  }

  const day = formatScheduleDay(scheduledDate);

  return scheduledFrom && scheduledTo ? `${day} ${scheduledFrom} - ${scheduledTo}` : day;
}

/** Texto de km y precio de envio ("12.5 km - Envio S/ 5.00"), o null si no se registro ninguno. */
export function formatShipping({ distanceKm, shippingPrice }: { distanceKm: number | null; shippingPrice: number }): string | null {
  const parts = [
    distanceKm !== null ? `${distanceKm} km` : null,
    shippingPrice > 0 ? `Envio ${formatCurrency(shippingPrice)}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' - ') : null;
}
