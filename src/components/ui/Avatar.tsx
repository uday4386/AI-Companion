import clsx from 'clsx';
import { initials } from '@/lib/format';
import { AVATAR_TONES } from '@/lib/constants';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<Size, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-[12px]',
  lg: 'h-11 w-11 text-sm',
};

interface AvatarProps {
  name: string | null | undefined;
  tone?: string | null;
  size?: Size;
  className?: string;
  ring?: boolean;
  title?: string;
}

export function Avatar({ name, tone: toneName = 'indigo', size = 'md', className, ring = true, title }: AvatarProps) {
  return (
    <span
      title={title ?? name ?? undefined}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold uppercase tracking-wide',
        ring && 'ring-1 ring-inset',
        SIZES[size],
        AVATAR_TONES[toneName ?? 'indigo'] ?? AVATAR_TONES.indigo,
        className,
      )}
      aria-hidden={!title}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarGroup({ people, max = 3 }: { people: { id: string; fullName: string; avatarTone?: string }[]; max?: number }) {
  const visible = people.slice(0, max);
  const rest = people.length - visible.length;
  return (
    <div className="flex items-center">
      {visible.map((person) => (
        <Avatar
          key={person.id}
          name={person.fullName}
          tone={person.avatarTone}
          size="xs"
          className="-ml-1.5 ring-2 ring-white first:ml-0 dark:ring-slate-900"
        />
      ))}
      {rest > 0 ? (
        <span className="-ml-1.5 inline-flex h-6 items-center rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500 ring-2 ring-white dark:bg-white/10 dark:text-slate-300 dark:ring-slate-900">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
