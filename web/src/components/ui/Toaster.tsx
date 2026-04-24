import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

import { cn } from '../../lib/cn';
import { useToastStore, type ToastKind } from '../../store/toastStore';

const VARIANTS: Record<ToastKind, { icon: typeof CheckCircle2; chip: string; iconColor: string }> = {
  success: { icon: CheckCircle2, chip: 'border-success/40 bg-success/10', iconColor: 'text-success' },
  error: { icon: AlertTriangle, chip: 'border-danger/40 bg-danger/10', iconColor: 'text-danger' },
  info: { icon: Info, chip: 'border-accent/40 bg-accent/10', iconColor: 'text-accent' },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]"
    >
      {toasts.map((t) => {
        const v = VARIANTS[t.kind];
        const Icon = v.icon;
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto bg-bg-card border rounded-xl shadow-xl shadow-black/40 p-3.5 pr-2',
              'flex items-start gap-3 animate-fade-in-up',
              v.chip,
            )}
          >
            <Icon size={18} className={cn('mt-0.5 shrink-0', v.iconColor)} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text leading-tight">{t.title}</div>
              {t.description ? (
                <div className="text-xs text-muted mt-1 leading-snug whitespace-pre-wrap break-words">
                  {t.description}
                </div>
              ) : null}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-1 text-muted/70 hover:text-text transition-colors rounded"
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
