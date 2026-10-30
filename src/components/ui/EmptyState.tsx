import clsx from 'clsx';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 text-center', compact ? 'py-8' : 'py-14', className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 -z-10 blur-xl">
          <div className="mx-auto h-10 w-10 rounded-full bg-brand-400/30" />
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-400 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this view. Please retry.',
  onRetry,
  children,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300">
        <Inbox className="h-5 w-5" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-slate-500 dark:text-slate-400">{description}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm mt-4">
          Try again
        </button>
      ) : null}
      {children}
    </div>
  );
}
