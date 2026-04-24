import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export function Card({ className, interactive, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'bg-bg-card border border-border rounded-xl',
        interactive && 'cursor-pointer hover:border-accent/40 transition-colors',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function CardHeader({ title, subtitle, actions, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 py-3 border-b border-border', className)}>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-text truncate">{title}</h3>
        {subtitle ? <p className="text-sm text-muted mt-0.5">{subtitle}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
