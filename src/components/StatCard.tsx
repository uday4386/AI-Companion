import clsx from 'clsx';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { tone } from '@/lib/constants';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  hint?: React.ReactNode;
  delta?: { value: number; label?: string } | null;
  onClick?: () => void;
  bars?: number[];
  className?: string;
  emphasis?: boolean;
}

export function StatCard({ label, value, icon: Icon, color = 'brand', hint, delta, onClick, bars, className, emphasis }: StatCardProps) {
  const classes = tone(color === 'brand' ? 'indigo' : color);
  const Component: React.ElementType = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-card transition dark:bg-slate-900/60',
        emphasis
          ? 'border-brand-200/70 dark:border-brand-500/20'
          : 'border-slate-200/80 dark:border-white/[0.08]',
        onClick && 'hover:-translate-y-0.5 hover:border-brand-300/70 hover:shadow-pop dark:hover:border-brand-500/30',
        className,
      )}
    >
      {emphasis ? (
        <div className="pointer-events-none absolute inset-x-0 -top-16 h-24 bg-gradient-to-b from-brand-500/10 to-transparent" aria-hidden />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11.5px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">{value}</p>
        </div>
        <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', classes.softBg, classes.text)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {delta ? (
            <span
              className={clsx(
                'inline-flex items-center gap-0.5 text-[11.5px] font-semibold',
                delta.value > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta.value < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500',
              )}
            >
              {delta.value > 0 ? <ArrowUpRight className="h-3 w-3" /> : delta.value < 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
              {Math.abs(delta.value)}%
              {delta.label ? <span className="ml-1 font-medium text-slate-400 dark:text-slate-500">{delta.label}</span> : null}
            </span>
          ) : hint ? (
            <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">{hint}</span>
          ) : null}
        </div>
        {bars?.length ? (
          <div className="flex h-6 items-end gap-[3px]" aria-hidden>
            {bars.map((bar, index) => (
              <span
                key={index}
                className={clsx('w-1 rounded-sm', classes.softBg)}
                style={{ height: `${Math.max(12, Math.min(100, bar))}%`, backgroundColor: index === bars.length - 1 ? classes.hex : undefined }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </Component>
  );
}
