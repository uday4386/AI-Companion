import clsx from 'clsx';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  variant?: 'underline' | 'pill';
}

export function Tabs<T extends string>({ items, value, onChange, className, variant = 'underline' }: TabsProps<T>) {
  if (variant === 'pill') {
    return (
      <div className={clsx('inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-white/[0.05]', className)}>
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition',
                active
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-white/[0.1] dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {item.icon ? <item.icon className="h-3.5 w-3.5" /> : null}
              {item.label}
              {typeof item.count === 'number' ? (
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' : 'bg-slate-200/70 text-slate-500 dark:bg-white/10 dark:text-slate-400',
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={clsx('flex items-center gap-1 overflow-x-auto border-b border-slate-200/80 dark:border-white/[0.08]', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={clsx(
              'relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold transition',
              active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {item.icon ? <item.icon className="h-4 w-4" /> : null}
            {item.label}
            {typeof item.count === 'number' ? (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">
                {item.count}
              </span>
            ) : null}
            {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" /> : null}
          </button>
        );
      })}
    </div>
  );
}
