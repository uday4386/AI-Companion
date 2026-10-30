import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-4 w-4 animate-spin', className)} aria-hidden />;
}

export function PageLoader({ label = 'Loading workspace…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div className="relative">
        <div className="absolute inset-0 animate-pulse rounded-2xl bg-brand-500/20 blur-xl" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-white/10">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600 dark:text-brand-300" />
        </div>
      </div>
      <p className="text-[13px] text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function TableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-white/5">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton
              key={colIndex}
              className={clsx('h-4', colIndex === 0 ? 'w-24' : colIndex === 1 ? 'flex-1' : 'w-16')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('card p-5', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-28" />
      <Skeleton className="mt-3 h-3 w-40" />
    </div>
  );
}
