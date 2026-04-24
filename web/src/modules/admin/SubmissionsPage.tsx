import { ChevronLeft, ChevronRight, Filter, History } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useSubmission, useSubmissions, type SubmissionRow, type SubmissionsFilter } from '../../api/admin';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Table, type Column } from '../../components/ui/Table';
import type { FormSlug } from '../../lib/types';

const FORM_OPTIONS: { value: '' | FormSlug; label: string }[] = [
  { value: '', label: 'Todos los formularios' },
  { value: 'registrar-unidad-adn', label: 'Registrar Unidades (ADN)' },
  { value: 'registrar-unidad-cliente', label: 'Registrar Unidades (Cliente)' },
  { value: 'registrar-operador-adn', label: 'Registrar Operadores (ADN)' },
  { value: 'registrar-operador-cliente', label: 'Registrar Operadores (Cliente)' },
  { value: 'placa-remolque', label: 'Placa Remolque' },
  { value: 'eliminar-tara', label: 'Eliminar Tara' },
  { value: 'registrar-proveedor', label: 'Registrar Proveedor' },
  { value: 'habilitar-concat-rem', label: 'Habilitar Concat Remision' },
  { value: 'eliminar-entrada-lre', label: 'Eliminar Entrada LRE' },
  { value: 'eliminar-salida-tara-lrs', label: 'Eliminar Salida-Tara-LRS' },
  { value: 'permitir-pesaje-manual', label: 'Permitir Pesaje Manual' },
];

const PAGE_SIZE = 50;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
}

export function SubmissionsPage() {
  const [formSlug, setFormSlug] = useState<'' | FormSlug>('');
  const [result, setResult] = useState<'' | 'ok' | 'error'>('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<SubmissionRow | null>(null);

  const filter: SubmissionsFilter = useMemo(
    () => ({
      ...(formSlug ? { formSlug } : {}),
      ...(result ? { result } : {}),
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    [formSlug, result, desde, hasta, offset],
  );

  const query = useSubmissions(filter);
  const rows = query.data?.submissions ?? [];
  const total = query.data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  function resetFilters(): void {
    setFormSlug('');
    setResult('');
    setDesde('');
    setHasta('');
    setOffset(0);
  }

  const columns: Column<SubmissionRow>[] = [
    {
      key: 'created_at',
      header: 'Fecha',
      width: '180px',
      render: (s) => <span className="font-mono text-xs text-muted">{formatDateTime(s.created_at)}</span>,
    },
    {
      key: 'usuario_email',
      header: 'Usuario',
      render: (s) => <span className="truncate">{s.usuario_email}</span>,
    },
    {
      key: 'form_slug',
      header: 'Formulario',
      render: (s) => <span className="font-mono text-xs">{s.form_slug}</span>,
    },
    {
      key: 'result',
      header: 'Resultado',
      width: '110px',
      render: (s) =>
        s.result === 'ok' ? (
          <Badge variant="success" dot>OK</Badge>
        ) : (
          <Badge variant="danger" dot>Error</Badge>
        ),
    },
    {
      key: 'duration_ms',
      header: 'ms',
      width: '80px',
      align: 'right',
      render: (s) => <span className="font-mono text-xs tabular-nums text-muted">{s.duration_ms}</span>,
    },
    {
      key: 'error_message',
      header: 'Mensaje',
      render: (s) =>
        s.error_message ? (
          <span className="text-danger text-xs line-clamp-2">{s.error_message}</span>
        ) : (
          <span className="text-muted/50">—</span>
        ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Auditoria</h1>
          <p className="text-sm text-muted mt-1">Historial completo de envios de todos los formularios.</p>
        </div>
        {total > 0 ? <Badge variant="cyan" dot>{total} registros</Badge> : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Select
          value={formSlug}
          onChange={(e) => {
            setFormSlug(e.target.value as '' | FormSlug);
            setOffset(0);
          }}
          options={FORM_OPTIONS}
        />
        <Select
          value={result}
          onChange={(e) => {
            setResult(e.target.value as '' | 'ok' | 'error');
            setOffset(0);
          }}
          options={[
            { value: '', label: 'OK + Error' },
            { value: 'ok', label: 'Solo OK' },
            { value: 'error', label: 'Solo Error' },
          ]}
        />
        <Input
          type="date"
          value={desde}
          onChange={(e) => {
            setDesde(e.target.value);
            setOffset(0);
          }}
          placeholder="Desde"
        />
        <Input
          type="date"
          value={hasta}
          onChange={(e) => {
            setHasta(e.target.value);
            setOffset(0);
          }}
          placeholder="Hasta"
        />
        <Button variant="secondary" icon={Filter} onClick={resetFilters}>
          Limpiar filtros
        </Button>
      </div>

      <Table
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        onRowClick={(r) => setSelected(r)}
        isLoading={query.isPending}
        emptyTitle="Sin submissions"
        emptyDescription="No hay envios que coincidan con los filtros."
      />

      {total > 0 ? (
        <div className="flex items-center justify-between mt-4 text-sm text-muted">
          <div>
            Mostrando <span className="text-text font-medium">{from}–{to}</span> de{' '}
            <span className="text-text font-medium">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              disabled={offset === 0 || query.isPending}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              iconPosition="right"
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              disabled={to >= total || query.isPending}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      {query.isError ? (
        <div className="mt-3 text-sm text-danger flex items-center gap-2">
          <History size={14} /> Error al cargar el historial.
        </div>
      ) : null}

      <SubmissionDetailModal row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function SubmissionDetailModal({ row, onClose }: { row: SubmissionRow | null; onClose: () => void }) {
  const detail = useSubmission(row?.id);

  return (
    <Modal open={Boolean(row)} onClose={onClose} title="Detalle del envio" size="lg">
      {!detail.data ? (
        <div className="py-6 text-center text-muted text-sm">Cargando...</div>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Fecha</dt>
            <dd className="font-mono text-xs">{formatDateTime(detail.data.created_at)}</dd>
            <dt className="text-muted">Usuario</dt>
            <dd>{detail.data.usuario_email}</dd>
            <dt className="text-muted">Formulario</dt>
            <dd className="font-mono text-xs">{detail.data.form_slug}</dd>
            <dt className="text-muted">Stored Procedure</dt>
            <dd className="font-mono text-xs">{detail.data.sp_name}</dd>
            <dt className="text-muted">Resultado</dt>
            <dd>
              {detail.data.result === 'ok' ? (
                <Badge variant="success" dot>OK</Badge>
              ) : (
                <Badge variant="danger" dot>Error</Badge>
              )}
            </dd>
            <dt className="text-muted">Duracion</dt>
            <dd className="font-mono text-xs tabular-nums">{detail.data.duration_ms} ms</dd>
            {detail.data.error_message ? (
              <>
                <dt className="text-muted">Mensaje</dt>
                <dd className="text-xs text-danger whitespace-pre-wrap break-words">{detail.data.error_message}</dd>
              </>
            ) : null}
          </dl>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted/70 mb-1.5">Payload enviado</div>
            <pre className="bg-bg-surface border border-border rounded-lg p-3 text-xs font-mono text-text overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(JSON.parse(detail.data.payload_json), null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Modal>
  );
}
