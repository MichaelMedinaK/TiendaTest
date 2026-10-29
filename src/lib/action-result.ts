/**
 * Resultado uniforme de toda Server Action.
 * Los componentes cliente pueden renderizar el error sin conocer la excepcion original.
 */
export type ActionResult<TData = void> =
  | { success: true; data: TData }
  | { success: false; error: string };

export function success<TData>(data: TData): ActionResult<TData> {
  return { success: true, data };
}

export function failure<TData = void>(error: string): ActionResult<TData> {
  return { success: false, error };
}
