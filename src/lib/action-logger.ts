import { randomUUID } from 'node:crypto';

export type ActionLogStatus = 'OK' | 'BUSINESS_ERROR' | 'TECHNICAL_ERROR';

/**
 * Acumula los pasos de una Server Action en memoria para emitir UN SOLO log
 * estructurado al finalizar. Evita la dispersion de logs por flujo, que es el
 * principal generador de coste en plataformas de observabilidad.
 */
export class ActionTrace {
  readonly traceId: string;
  readonly spanId: string;
  private readonly actionName: string;
  private readonly startedAtMs: number;
  private readonly steps: string[] = [];
  private businessId?: string;

  constructor(actionName: string, businessId?: string) {
    this.actionName = actionName;
    this.traceId = randomUUID();
    this.spanId = randomUUID().slice(0, 16);
    this.startedAtMs = Date.now();
    this.businessId = businessId;
  }

  addStep(step: string): void {
    this.steps.push(step);
  }

  /** Vincula el identificador de negocio (orderId, userId, productId) con la traza tecnica. */
  setBusinessId(businessId: string): void {
    this.businessId = businessId;
  }

  flush(status: ActionLogStatus, errorMessage?: string): void {
    const logEntry = {
      trace_id: this.traceId,
      span_id: this.spanId,
      'dd.trace_id': this.traceId,
      'dd.span_id': this.spanId,
      business_id: this.businessId ?? null,
      uri: `/actions/${this.actionName}`,
      method: 'SERVER_ACTION',
      duration_ms: Date.now() - this.startedAtMs,
      status,
      error: errorMessage ?? null,
      steps: this.steps,
    };

    const serializedLog = JSON.stringify(logEntry);

    if (status === 'TECHNICAL_ERROR') {
      console.error(serializedLog);
      return;
    }

    console.log(serializedLog);
  }
}
