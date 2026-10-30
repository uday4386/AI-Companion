import clsx from 'clsx';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Switch({ checked, onChange, label, description, disabled, size = 'md' }: SwitchProps) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-5 w-9' : 'h-6 w-11',
        checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700',
      )}
    >
      <span
        className={clsx(
          'inline-block transform rounded-full bg-white shadow transition-transform',
          size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5 h-[18px] w-[18px]',
          checked ? (size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]') : 'translate-x-[3px]',
        )}
      />
    </button>
  );

  if (!label && !description) return control;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {label ? <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{label}</p> : null}
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      {control}
    </div>
  );
}
