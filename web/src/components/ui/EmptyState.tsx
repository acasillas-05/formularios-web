import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/cn';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <Icon size={48} className="text-muted/40 mb-4" />
      <h3 className="text-lg font-medium text-muted">{title}</h3>
      {description ? <p className="text-sm text-muted/70 max-w-sm mt-1.5">{description}</p> : null}
      {action ? (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-lg bg-accent text-bg-primary text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
