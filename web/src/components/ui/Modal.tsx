import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/cn';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  /** Cuando true, no cierra al hacer click en el backdrop (util durante un submit). */
  disableBackdropClose?: boolean;
};

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  disableBackdropClose,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={disableBackdropClose ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'bg-bg-card border border-border rounded-2xl shadow-2xl shadow-black/50',
          'w-full flex flex-col max-h-[85vh]',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-text">{title}</div>
            {description ? <div className="text-sm text-muted mt-0.5">{description}</div> : null}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 -m-1.5 text-muted hover:text-text hover:bg-bg-surface rounded-md transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer ? (
          <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
