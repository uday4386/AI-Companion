import clsx from 'clsx';
import { tone } from '@/lib/constants';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}

export function Badge({ children, color = 'slate', dot = false, size = 'md', className, title }: BadgeProps) {
  const classes = tone(color);
  return (
    <span title={title} className={clsx('badge', classes.badge, size === 'sm' && 'badge-sm', className)}>
      {dot ? <span className={clsx('h-1.5 w-1.5 rounded-full', classes.dot)} aria-hidden /> : null}
      {children}
    </span>
  );
}
