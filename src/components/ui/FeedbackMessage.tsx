import { AlertCircle, CheckCircle2 } from 'lucide-react';

export type FeedbackTone = 'error' | 'success';

interface FeedbackMessageProps {
  tone: FeedbackTone;
  message: string;
}

const TONE_STYLES: Record<FeedbackTone, string> = {
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function FeedbackMessage({ tone, message }: FeedbackMessageProps) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;

  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${TONE_STYLES[tone]}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}
