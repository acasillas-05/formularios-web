import { AlertTriangle, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { Button } from './Button';
import { Modal } from './Modal';

type ConfirmVariant = 'danger' | 'warning';

type ConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
};

const VARIANTS: Record<ConfirmVariant, { icon: typeof Trash2; chip: string; color: string }> = {
  danger: { icon: Trash2, chip: 'bg-danger/15 text-danger', color: 'text-danger' },
  warning: { icon: AlertTriangle, chip: 'bg-warning/15 text-warning', color: 'text-warning' },
};

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const v = VARIANTS[variant];
  const Icon = v.icon;

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onCancel}
      title={title}
      size="sm"
      disableBackdropClose={loading}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', v.chip)}>
          <Icon size={20} />
        </div>
        <div className="text-sm text-muted leading-relaxed">{description}</div>
      </div>
    </Modal>
  );
}
