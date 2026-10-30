'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles';

type ToastTone = 'success' | 'error';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

interface FeedbackApi {
  success: (message: string) => void;
  error: (message: string) => void;
  /** Abre un cuadro de confirmacion; resuelve true si el usuario acepta. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const MAX_VISIBLE_TOASTS = 4;
const TOAST_DURATION_MS: Record<ToastTone, number> = { success: 4000, error: 7000 };

const TOAST_STYLES: Record<ToastTone, { title: string; accent: string; iconWrapper: string; bar: string }> = {
  success: {
    title: 'Listo',
    accent: 'border-emerald-500',
    iconWrapper: 'bg-emerald-100 text-emerald-600',
    bar: 'bg-emerald-500',
  },
  error: {
    title: 'No se pudo completar',
    accent: 'border-rose-500',
    iconWrapper: 'bg-rose-100 text-rose-600',
    bar: 'bg-rose-500',
  },
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error('useFeedback debe usarse dentro de FeedbackProvider');
  }

  return context;
}

/** Notificaciones emergentes y cuadro de confirmacion compartidos por toda la aplicacion. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const nextToastId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, message: string) => {
    const id = nextToastId.current++;
    setToasts((current) => [...current.slice(-(MAX_VISIBLE_TOASTS - 1)), { id, tone, message }]);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPendingConfirm({ options, resolve })),
    [],
  );

  const settleConfirm = useCallback(
    (confirmed: boolean) => {
      pendingConfirm?.resolve(confirmed);
      setPendingConfirm(null);
    },
    [pendingConfirm],
  );

  const api = useMemo<FeedbackApi>(
    () => ({
      success: (message) => pushToast('success', message),
      error: (message) => pushToast('error', message),
      confirm,
    }),
    [pushToast, confirm],
  );

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col items-stretch gap-2 md:inset-x-auto md:right-4 md:top-4 md:w-96"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>

      {pendingConfirm && <ConfirmDialog options={pendingConfirm.options} onSettle={settleConfirm} />}
    </FeedbackContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const styles = TOAST_STYLES[toast.tone];
  const durationMs = TOAST_DURATION_MS[toast.tone];
  const Icon = toast.tone === 'success' ? CheckCircle2 : AlertCircle;

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, durationMs, onDismiss]);

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto relative animate-toast-in overflow-hidden rounded-xl border-l-4 bg-white shadow-xl ring-1 ring-slate-900/5 ${styles.accent}`}
    >
      <div className="flex items-start gap-3 p-3 pr-2">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${styles.iconWrapper}`}>
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{styles.title}</p>
          <p className="mt-0.5 break-words text-sm text-slate-600">{toast.message}</p>
        </div>

        <button
          type="button"
          aria-label="Cerrar aviso"
          onClick={() => onDismiss(toast.id)}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className={`h-1 origin-left animate-toast-progress ${styles.bar}`}
        style={{ animationDuration: `${durationMs}ms` }}
      />
    </div>
  );
}

function ConfirmDialog({
  options,
  onSettle,
}: {
  options: ConfirmOptions;
  onSettle: (confirmed: boolean) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onSettle(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSettle]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={() => onSettle(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-sm animate-pop-in rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900">
              {options.title}
            </h2>
            <p id="confirm-message" className="mt-1 break-words text-sm text-slate-600">
              {options.message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus className={SECONDARY_BUTTON_CLASS} onClick={() => onSettle(false)}>
            {options.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} bg-rose-600 hover:bg-rose-700`}
            onClick={() => onSettle(true)}
          >
            {options.confirmLabel ?? 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}
