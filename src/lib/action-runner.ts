import { ActionTrace } from './action-logger';
import { ActionResult, failure, success } from './action-result';
import { BusinessError } from './errors';

type ActionHandler<TData> = (trace: ActionTrace) => Promise<TData>;

const TECHNICAL_ERROR_MESSAGE = 'Ocurrio un error inesperado. Intentalo nuevamente';

/**
 * Punto unico de ejecucion de Server Actions: traza agregada, mapeo de
 * excepciones de negocio y contrato de salida homogeneo.
 */
export async function executeAction<TData>(
  actionName: string,
  handler: ActionHandler<TData>,
): Promise<ActionResult<TData>> {
  const trace = new ActionTrace(actionName);

  try {
    const data = await handler(trace);
    trace.flush('OK');
    return success(data);
  } catch (error) {
    if (error instanceof BusinessError) {
      trace.flush('BUSINESS_ERROR', error.message);
      return failure<TData>(error.message);
    }

    trace.flush('TECHNICAL_ERROR', error instanceof Error ? error.message : String(error));
    return failure<TData>(TECHNICAL_ERROR_MESSAGE);
  }
}
