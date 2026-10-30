import { AlertCircle, CheckCircle2 } from 'lucide-react';

export type FeedbackTone = 'error' | 'success';

interface FeedbackMessageProps {
  tone: FeedbackTone;
  message: string;
}

const TONE_STYLES: Record<FeedbackTone, { box: string; icon: string }> = {
  error: { box: 'border-rose-500 bg-rose-50 text-rose-800', icon: 'bg-rose-100 text-rose-600' },
  success: { box: 'border-emerald-500 bg-emerald-50 text-emerald-800', icon: 'bg-emerald-100 text-emerald-600' },
};

/** Aviso en linea (dentro de un formulario o pagina), con el mismo lenguaje visual que las notificaciones. */
export function FeedbackMessage({ tone, message }: FeedbackMessageProps) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  const styles = TONE_STYLES[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border-l-4 px-3 py-2.5 text-sm font-medium shadow-sm ${styles.box}`}
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${styles.icon}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 break-words pt-0.5">{message}</span>
    </div>
  );
}
