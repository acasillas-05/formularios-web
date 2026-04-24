import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'cyan' | 'blue';

type BadgeProps = {
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
  children: ReactNode;
};

const VARIANTS: Record<BadgeVariant, { chip: string; dot: string }> = {
  default: {
    chip: 'bg-bg-surface text-muted border-border',
    dot: 'bg-muted',
  },
  success: {
    chip: 'bg-success/12 text-success border-success/28',
    dot: 'bg-success',
  },
  warning: {
    chip: 'bg-warning/12 text-warning border-warning/28',
    dot: 'bg-warning',
  },
  danger: {
    chip: 'bg-danger/12 text-danger border-danger/28',
    dot: 'bg-danger',
  },
  cyan: {
    chip: 'bg-accent/12 text-accent border-accent/28',
    dot: 'bg-accent',
  },
  blue: {
    chip: 'bg-accent2/12 text-accent2 border-accent2/28',
    dot: 'bg-accent2',
  },
};

export function Badge({ variant = 'default', dot = false, className, children }: BadgeProps) {
  const styles = VARIANTS[variant];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border',
        styles.chip,
        className,
      )}
    >
      {dot ? <span className={cn('w-1.5 h-1.5 rounded-full', styles.dot)} /> : null}
      {children}
    </span>
  );
}
