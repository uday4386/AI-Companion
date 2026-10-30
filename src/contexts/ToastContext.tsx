import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import clsx from 'clsx';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastValue {
  push: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const KIND_STYLES: Record<ToastKind, { icon: typeof Info; ring: string; iconClass: string }> = {
  success: { icon: CheckCircle2, ring: 'ring-emerald-500/30', iconClass: 'text-emerald-500' },
  error: { icon: XCircle, ring: 'ring-rose-500/30', iconClass: 'text-rose-500' },
  info: { icon: Info, ring: 'ring-sky-500/30', iconClass: 'text-sky-500' },
  warning: { icon: AlertTriangle, ring: 'ring-amber-500/30', iconClass: 'text-amber-500' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((list) => [...list.slice(-4), { ...toast, id }]);
      window.setTimeout(() => remove(id), toast.kind === 'error' ? 6500 : 4500);
    },
    [remove],
  );

  const value: ToastValue = {
    push,
    success: (title, message) => push({ kind: 'success', title, message }),
    error: (title, message) => push({ kind: 'error', title, message }),
    info: (title, message) => push({ kind: 'info', title, message }),
    warning: (title, message) => push({ kind: 'warning', title, message }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5"
      >
        {toasts.map((toast) => {
          const config = KIND_STYLES[toast.kind];
          const Icon = config.icon;
          return (
            <div
              key={toast.id}
              role="status"
              className={clsx(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white p-3.5 shadow-pop ring-1 animate-slide-up dark:bg-slate-900',
                config.ring,
              )}
            >
              <Icon className={clsx('mt-0.5 h-[18px] w-[18px] shrink-0', config.iconClass)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white">{toast.title}</p>
                {toast.message ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{toast.message}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
