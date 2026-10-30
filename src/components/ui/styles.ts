/** Clases Tailwind compartidas: un unico punto de cambio para el look & feel. */
export const CARD_CLASS = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';

export const LABEL_CLASS = 'mb-1 block text-sm font-medium text-slate-700';

export const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100';

export const PRIMARY_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60';

export const SECONDARY_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';

export const TABLE_CLASS = 'min-w-full divide-y divide-slate-200 text-sm';

export const TABLE_HEAD_CELL_CLASS =
  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';

export const TABLE_CELL_CLASS = 'px-4 py-3 align-middle text-slate-700';

export const BADGE_CLASS = 'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold';

/**
 * Tabla responsive: en celulares cada elemento (`tbody`) es una tarjeta independiente, con borde, que
 * apila sus columnas con la etiqueta de cada una (atributo `data-label` de la celda). Desde `md` vuelve
 * a ser una tabla normal. La celda titulo (STACKED_TITLE_CELL_CLASS) hace de encabezado de la tarjeta.
 */
export const STACKED_WRAPPER_CLASS =
  'overflow-x-auto md:rounded-xl md:border md:border-slate-200 md:bg-white md:shadow-sm';

export const STACKED_TABLE_CLASS = 'block w-full text-sm md:table md:min-w-full md:divide-y md:divide-slate-200';

export const STACKED_HEAD_CLASS = 'hidden bg-slate-50 md:table-header-group';

export const STACKED_GROUP_CLASS =
  'mb-3 block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition md:mb-0 md:table-row-group md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:shadow-none';

/** Resalta el elemento que se esta editando para saber en cual se esta parado. */
export const STACKED_GROUP_ACTIVE_CLASS = 'border-brand-500 ring-2 ring-brand-500/40 md:ring-0 md:bg-brand-50';

export const STACKED_ROW_CLASS = 'block py-2 md:table-row md:py-0 md:hover:bg-slate-50';

export const STACKED_TITLE_CELL_CLASS =
  '-mt-2 mb-1 block border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-900 md:mb-0 md:mt-0 md:table-cell md:border-b-0 md:bg-transparent md:py-3 md:text-sm md:font-medium';

/** Fila extra (formulario de edicion) pegada a la tarjeta del elemento. */
export const STACKED_EDIT_ROW_CLASS = 'block border-t border-slate-200 bg-slate-50 md:table-row';

export const STACKED_EDIT_CELL_CLASS = 'block p-4 md:table-cell';

export const STACKED_CELL_CLASS =
  'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-1.5 text-right align-middle text-slate-700 before:shrink-0 before:text-left before:text-xs before:font-semibold before:uppercase before:tracking-wide before:text-slate-500 before:content-[attr(data-label)] md:table-cell md:py-3 md:text-left md:before:hidden';
