import ReactECharts from 'echarts-for-react';
import {
  Activity,
  Bell,
  Calendar,
  CheckCircle2,
  Gauge,
  TrendingUp,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { useStats, type StatsResponse } from '../../api/stats';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { Table, type Column } from '../../components/ui/Table';
import { cn } from '../../lib/cn';
import { useAppStore } from '../../store/appStore';

/* =========================================================
 * Helpers de tema (lee CSS vars en runtime)
 * ========================================================= */

function readTokens(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const root = getComputedStyle(document.documentElement);
  return {
    text: root.getPropertyValue('--color-text').trim() || '#E8F4FF',
    muted: root.getPropertyValue('--color-muted').trim() || '#7A9BB5',
    border: root.getPropertyValue('--color-border').trim() || '#1E3A5F',
    bgCard: root.getPropertyValue('--color-bg-card').trim() || '#0D1B2E',
    accent: root.getPropertyValue('--color-accent').trim() || '#00C8FF',
    success: root.getPropertyValue('--color-success').trim() || '#10B981',
    danger: root.getPropertyValue('--color-danger').trim() || '#EF4444',
  };
}

/* =========================================================
 * KPI cards
 * ========================================================= */

type KpiCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: 'cyan' | 'success' | 'warning' | 'danger' | 'muted';
};

const TONE_CLASSES: Record<NonNullable<KpiCardProps['tone']>, string> = {
  cyan: 'text-accent bg-accent/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  danger: 'text-danger bg-danger/10',
  muted: 'text-muted bg-bg-surface',
};

function KpiCard({ label, value, hint, icon: Icon, tone = 'cyan' }: KpiCardProps) {
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted/70">{label}</span>
        <span className={cn('w-8 h-8 rounded-md flex items-center justify-center', TONE_CLASSES[tone])}>
          <Icon size={16} />
        </span>
      </div>
      <div className="text-3xl font-semibold tabular-nums text-text font-mono">{value}</div>
      {hint ? <div className="text-xs text-muted">{hint}</div> : null}
    </Card>
  );
}

/* =========================================================
 * Charts
 * ========================================================= */

function buildTrendOption(series: StatsResponse['series'], tokens: Record<string, string>) {
  return {
    grid: { top: 16, left: 8, right: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: tokens.bgCard,
      borderColor: tokens.border,
      textStyle: { color: tokens.text, fontFamily: 'DM Sans' },
    },
    legend: { textStyle: { color: tokens.muted, fontFamily: 'DM Sans' } },
    xAxis: {
      type: 'category',
      data: series.map((s) => s.date.slice(5)), // MM-DD
      axisLine: { lineStyle: { color: tokens.border } },
      axisLabel: { color: tokens.muted, fontFamily: 'JetBrains Mono', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: tokens.border } },
      splitLine: { lineStyle: { color: tokens.border, opacity: 0.4 } },
      axisLabel: { color: tokens.muted, fontFamily: 'JetBrains Mono', fontSize: 10 },
      minInterval: 1,
    },
    series: [
      {
        name: 'OK',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.map((s) => s.ok),
        lineStyle: { color: tokens.success, width: 2 },
        itemStyle: { color: tokens.success },
        areaStyle: { color: tokens.success, opacity: 0.12 },
      },
      {
        name: 'Error',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.map((s) => s.error),
        lineStyle: { color: tokens.danger, width: 2 },
        itemStyle: { color: tokens.danger },
        areaStyle: { color: tokens.danger, opacity: 0.1 },
      },
    ],
  };
}

function buildByFormOption(byForm: StatsResponse['byForm'], tokens: Record<string, string>) {
  // Limita a top 11 (todos) y muestra horizontal
  const labels = byForm.map((b) => b.slug);
  const okData = byForm.map((b) => b.ok);
  const errData = byForm.map((b) => b.error);
  return {
    grid: { top: 16, left: 8, right: 24, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: tokens.bgCard,
      borderColor: tokens.border,
      textStyle: { color: tokens.text, fontFamily: 'DM Sans' },
    },
    legend: { textStyle: { color: tokens.muted, fontFamily: 'DM Sans' } },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: tokens.border } },
      splitLine: { lineStyle: { color: tokens.border, opacity: 0.4 } },
      axisLabel: { color: tokens.muted, fontFamily: 'JetBrains Mono', fontSize: 10 },
      minInterval: 1,
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: labels,
      axisLine: { lineStyle: { color: tokens.border } },
      axisLabel: { color: tokens.muted, fontFamily: 'JetBrains Mono', fontSize: 10, width: 180, overflow: 'truncate' },
    },
    series: [
      {
        name: 'OK',
        type: 'bar',
        stack: 'total',
        data: okData,
        itemStyle: { color: tokens.success, borderRadius: [0, 2, 2, 0] },
      },
      {
        name: 'Error',
        type: 'bar',
        stack: 'total',
        data: errData,
        itemStyle: { color: tokens.danger, borderRadius: [0, 2, 2, 0] },
      },
    ],
  };
}

/* =========================================================
 * Page
 * ========================================================= */

export function DashboardPage() {
  const [days, setDays] = useState(30);
  const theme = useAppStore((s) => s.theme);
  const query = useStats(days);

  const tokens = useMemo(() => readTokens(), [theme]);

  if (query.isPending) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card className="p-8 text-center">
        <p className="text-danger">No se pudieron cargar las estadisticas.</p>
      </Card>
    );
  }

  const data = query.data;
  const k = data.kpis;
  const errorRatePct = (k.errorRate * 100).toFixed(1);
  const last24Total = k.last24hOk + k.last24hErr;

  const trendOption = buildTrendOption(data.series, tokens);
  const byFormOption = buildByFormOption(data.byForm, tokens);

  const userColumns: Column<{ email: string; count: number }>[] = [
    { key: 'email', header: 'Usuario', render: (u) => <span className="text-sm">{u.email}</span> },
    {
      key: 'count',
      header: 'Envios',
      width: '120px',
      align: 'right',
      render: (u) => <span className="font-mono text-sm tabular-nums text-muted">{u.count}</span>,
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Resumen operativo de la plataforma — ventana de los ultimos {data.window.days} dias.
          </p>
        </div>
        <Select
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
          options={[
            { value: '7', label: 'Ultimos 7 dias' },
            { value: '14', label: 'Ultimos 14 dias' },
            { value: '30', label: 'Ultimos 30 dias' },
            { value: '90', label: 'Ultimos 90 dias' },
          ]}
          className="max-w-[200px]"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          label="Hoy"
          value={k.today}
          hint="Submissions desde 00:00 UTC"
          icon={Calendar}
          tone="cyan"
        />
        <KpiCard
          label="Ultimas 24h"
          value={
            <span>
              <span className="text-success">{k.last24hOk}</span>
              <span className="text-muted/60 mx-1.5 text-2xl">/</span>
              <span className="text-danger">{k.last24hErr}</span>
            </span>
          }
          hint={
            last24Total > 0 ? (
              <>
                {last24Total} totales
                {k.last24hErr > 0 ? ` · ${((k.last24hErr / last24Total) * 100).toFixed(1)}% error` : ''}
              </>
            ) : (
              'Sin actividad en 24h'
            )
          }
          icon={Activity}
          tone={k.last24hErr === 0 ? 'success' : 'warning'}
        />
        <KpiCard
          label="Latencia (window)"
          value={
            <span>
              {k.windowTotal > 0 ? data.latency.p50 : 0}
              <span className="text-muted/60 mx-1.5 text-2xl">/</span>
              {k.windowTotal > 0 ? data.latency.p95 : 0}
            </span>
          }
          hint="P50 / P95 ms"
          icon={Gauge}
          tone="muted"
        />
        <KpiCard
          label="Notifs pendientes"
          value={k.pendingNotifs}
          hint={k.pendingNotifs === 0 ? 'Cola vacia' : 'Worker procesando'}
          icon={Bell}
          tone={k.pendingNotifs === 0 ? 'success' : 'warning'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-muted" />
              <h2 className="text-sm font-semibold text-text">Tendencia diaria</h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success" /> OK ({k.windowOk})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-danger" /> Error ({k.windowErr})
              </span>
            </div>
          </div>
          <div className="h-[280px]">
            {data.series.length > 0 ? (
              <ReactECharts option={trendOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted">
                Sin actividad en la ventana.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-muted" />
              <h2 className="text-sm font-semibold text-text">Salud de la ventana</h2>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-y-3 text-sm">
            <Row label="Total submissions" value={k.windowTotal.toLocaleString('es-MX')} />
            <Row
              label="Tasa de error"
              value={
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    k.errorRate === 0 ? 'text-success' : k.errorRate > 0.1 ? 'text-danger' : 'text-warning',
                  )}
                >
                  {errorRatePct}%
                </span>
              }
              icon={k.errorRate === 0 ? CheckCircle2 : XCircle}
            />
            <Row label="Latencia P99" value={`${data.latency.p99} ms`} />
            <Row label="Usuarios activos" value={k.activeUsers} icon={Users} />
            <Row label="Notifs pendientes" value={k.pendingNotifs} icon={Bell} />
          </dl>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} className="text-muted" />
            <h2 className="text-sm font-semibold text-text">Submissions por formulario</h2>
          </div>
          <div className="h-[320px]">
            {data.byForm.length > 0 ? (
              <ReactECharts option={byFormOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted">
                Sin envios en la ventana.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-muted" />
              <h2 className="text-sm font-semibold text-text">Top usuarios</h2>
            </div>
            <Badge variant="cyan" dot>
              top 5
            </Badge>
          </div>
          <Table
            columns={userColumns}
            rows={data.topUsers}
            getRowKey={(u) => u.email}
            emptyTitle="Sin actividad"
            emptyDescription="Aun no hay envios."
            skeletonRows={3}
          />
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted flex items-center gap-2">
        {Icon ? <Icon size={14} className="text-muted/60" /> : null}
        {label}
      </dt>
      <dd className="font-mono text-text tabular-nums">{value}</dd>
    </div>
  );
}
