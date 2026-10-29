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
