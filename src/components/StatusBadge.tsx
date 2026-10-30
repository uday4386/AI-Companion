import clsx from 'clsx';
import { STATUS_LABEL, STATUS_TONE, PRIORITY_LABEL, PRIORITY_TONE, tone } from '@/lib/constants';
import type { Priority, Status } from '@/lib/types';

export function StatusBadge({ status, size = 'md', className }: { status: Status; size?: 'sm' | 'md'; className?: string }) {
  const classes = tone(STATUS_TONE[status]);
  return (
    <span className={clsx('badge', classes.badge, size === 'sm' && 'badge-sm', className)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', classes.dot)} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority, size = 'md', className }: { priority: Priority; size?: 'sm' | 'md'; className?: string }) {
  const classes = tone(PRIORITY_TONE[priority]);
  return (
    <span className={clsx('badge', classes.badge, size === 'sm' && 'badge-sm', className)}>
      {priority === 'critical' ? (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden>
          <path d="M6 0 12 11H0z" />
        </svg>
      ) : (
        <span className={clsx('h-1.5 w-1.5 rounded-full', classes.dot)} aria-hidden />
      )}
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function ApplicationTag({
  application,
  className,
}: {
  application: { name: string; color: string } | null | undefined;
  className?: string;
}) {
  if (!application) return null;
  const classes = tone(application.color);
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        classes.badge,
        className,
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', classes.dot)} aria-hidden />
      {application.name}
    </span>
  );
}

export function StatusDot({ status }: { status: Status }) {
  const classes = tone(STATUS_TONE[status]);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <span className={clsx('h-1.5 w-1.5 rounded-full', classes.dot)} /> {STATUS_LABEL[status]}
    </span>
  );
}
