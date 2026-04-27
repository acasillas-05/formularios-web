import { ApiError } from '../../api/client';
import {
  useAdminNotifications,
  useResendNotification,
  type AdminNotification,
} from '../../api/notifications';
import { Bell, BellRing, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { Table, type Column } from '../../components/ui/Table';
import { absoluteDateTime, relativeTime } from '../../lib/relativeTime';
import { toast } from '../../store/toastStore';

function tryParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

function previewPayload(json: string, limit = 80): string {
  const v = tryParse(json);
  if (typeof v === 'string') return v.length > limit ? `${v.slice(0, limit)}…` : v;
  const flat = JSON.stringify(v);
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

const KIND_VARIANTS: Record<string, 'danger' | 'success' | 'cyan' | 'default'> = {
  error_submit: 'danger',
  success: 'success',
};

function kindBadge(kind: string) {
  const variant = KIND_VARIANTS[kind] ?? 'default';
  return (
    <Badge variant={variant} dot>
      {kind}
    </Badge>
  );
}

export function NotificationsPage() {
  const query = useAdminNotifications();
  const resend = useResendNotification();
  const [selected, setSelected] = useState<AdminNotification | null>(null);

  const pending = query.data?.pending ?? [];
  const lastSent = query.data?.lastSent ?? [];
  const totals = query.data?.totals ?? [];

  async function handleResend(n: AdminNotification): Promise<void> {
    try {
      await resend.mutateAsync(n.id);
      toast({
        kind: 'success',
        title: 'Notificacion encolada',
        description: 'El worker la procesara en el siguiente tick (~15s).',
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Error desconocido';
      toast({ kind: 'error', title: 'No se pudo reencolar', description: msg });
    }
  }

  const pendingColumns: Column<AdminNotification>[] = [
    {
      key: 'created_at',
      header: 'Encolado',
      width: '160px',
      render: (n) => (
        <div className="text-xs">
          <div className="text-text">{relativeTime(n.created_at)}</div>
          <div className="text-muted/60 font-mono">{absoluteDateTime(n.created_at)}</div>
        </div>
      ),
    },
    { key: 'kind', header: 'Tipo', width: '140px', render: (n) => kindBadge(n.kind) },
    {
      key: 'submission_id',
      header: 'Submission',
      width: '120px',
      render: (n) =>
        n.submission_id ? (
          <span className="font-mono text-xs text-muted">{n.submission_id.slice(0, 8)}</span>
        ) : (
          <span className="text-muted/50">—</span>
        ),
    },
    {
      key: 'payload_preview',
      header: 'Payload',
      render: (n) => (
        <span className="text-xs text-muted/80 line-clamp-2 break-all">{previewPayload(n.payload_json, 140)}</span>
      ),
    },
  ];

  const sentColumns: Column<AdminNotification>[] = [
    {
      key: 'sent_at',
      header: 'Enviado',
      width: '160px',
      render: (n) => (
        <div className="text-xs">
          <div className="text-success">{relativeTime(n.sent_at)}</div>
          <div className="text-muted/60 font-mono">{absoluteDateTime(n.sent_at)}</div>
        </div>
      ),
    },
    { key: 'kind', header: 'Tipo', width: '140px', render: (n) => kindBadge(n.kind) },
    {
      key: 'submission_id',
      header: 'Submission',
      width: '120px',
      render: (n) =>
        n.submission_id ? (
          <span className="font-mono text-xs text-muted">{n.submission_id.slice(0, 8)}</span>
        ) : (
          <span className="text-muted/50">—</span>
        ),
    },
    {
      key: 'lag',
      header: 'Tiempo en cola',
      width: '140px',
      render: (n) => {
        if (!n.sent_at) return <span className="text-muted/50">—</span>;
        const lag = (new Date(n.sent_at).getTime() - new Date(n.created_at).getTime()) / 1000;
        const fmt = lag < 60 ? `${Math.round(lag)} s` : `${Math.round(lag / 60)} min`;
        return <span className="font-mono text-xs tabular-nums text-muted">{fmt}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '120px',
      align: 'right',
      render: (n) => (
        <Button
          size="sm"
          variant="ghost"
          icon={RefreshCw}
          onClick={(e) => {
            e.stopPropagation();
            void handleResend(n);
          }}
          disabled={resend.isPending}
        >
          Reencolar
        </Button>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Notificaciones</h1>
          <p className="text-sm text-muted mt-1">
            Cola de notificaciones procesada por el worker (tick cada 15s).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pending.length === 0 ? (
            <Badge variant="success" dot>
              Cola vacia
            </Badge>
          ) : (
            <Badge variant="warning" dot>
              {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
            </Badge>
          )}
          <Button
            size="sm"
            variant="secondary"
            icon={RefreshCw}
            onClick={() => void query.refetch()}
            loading={query.isFetching}
          >
            Refrescar
          </Button>
        </div>
      </div>

      {totals.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-4">
          {totals.map((t) => (
            <Badge key={t.kind} variant="default">
              <span className="text-muted">{t.kind}:</span>
              <span className="text-text font-medium tabular-nums">{t._count._all}</span>
            </Badge>
          ))}
        </div>
      ) : null}

      {query.isPending ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size={28} />
        </div>
      ) : (
        <>
          <SectionTitle icon={BellRing} title="Pendientes de envio" caption="El worker drena en el proximo tick." />
          <Table
            columns={pendingColumns}
            rows={pending}
            getRowKey={(n) => n.id}
            onRowClick={(n) => setSelected(n)}
            emptyTitle="Sin notificaciones pendientes"
            emptyDescription="Todas las notificaciones se han procesado correctamente."
          />

          <div className="mt-6">
            <SectionTitle icon={CheckCircle2} title="Ultimas enviadas" caption="50 mas recientes con tiempo en cola." />
            <Table
              columns={sentColumns}
              rows={lastSent}
              getRowKey={(n) => n.id}
              onRowClick={(n) => setSelected(n)}
              emptyTitle="Sin envios todavia"
              emptyDescription="Aun no se ha enviado ninguna notificacion."
            />
          </div>
        </>
      )}

      <NotificationDetailModal notification={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  caption,
}: {
  icon: typeof Bell;
  title: string;
  caption?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon size={16} className="text-muted" />
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      {caption ? <span className="text-xs text-muted/70 ml-1">· {caption}</span> : null}
    </div>
  );
}

function NotificationDetailModal({
  notification,
  onClose,
}: {
  notification: AdminNotification | null;
  onClose: () => void;
}) {
  if (!notification) return null;
  const parsed = tryParse(notification.payload_json);
  return (
    <Modal open onClose={onClose} title="Detalle de notificacion" size="lg">
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">ID</dt>
          <dd className="font-mono text-xs">{notification.id}</dd>
          <dt className="text-muted">Tipo</dt>
          <dd>{kindBadge(notification.kind)}</dd>
          <dt className="text-muted">Submission</dt>
          <dd className="font-mono text-xs">{notification.submission_id ?? '—'}</dd>
          <dt className="text-muted">Encolado</dt>
          <dd>
            <span className="text-text">{relativeTime(notification.created_at)}</span>
            <span className="text-muted/60 ml-2 font-mono text-xs">{absoluteDateTime(notification.created_at)}</span>
          </dd>
          <dt className="text-muted">Estado</dt>
          <dd>
            {notification.sent_at ? (
              <span className="inline-flex items-center gap-1.5">
                <Badge variant="success" dot>
                  Enviada
                </Badge>
                <span className="text-xs text-muted">{relativeTime(notification.sent_at)}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Badge variant="warning" dot>
                  Pendiente
                </Badge>
                <Clock size={12} className="text-muted" />
              </span>
            )}
          </dd>
        </dl>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted/70 mb-1.5">Payload</div>
          <pre className="bg-bg-surface border border-border rounded-lg p-3 text-xs font-mono text-text overflow-x-auto max-h-72 overflow-y-auto">
            {typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      </div>
    </Modal>
  );
}
