import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiGet } from './client';

export type StatsResponse = {
  ok: true;
  window: { days: number; from: string; to: string };
  kpis: {
    today: number;
    last24hOk: number;
    last24hErr: number;
    windowOk: number;
    windowErr: number;
    windowTotal: number;
    errorRate: number;
    activeUsers: number;
    pendingNotifs: number;
  };
  latency: { p50: number; p95: number; p99: number };
  series: { date: string; ok: number; error: number }[];
  byForm: { slug: string; ok: number; error: number; total: number }[];
  topUsers: { email: string; count: number }[];
};

export const statsKeys = {
  base: ['admin', 'stats'] as const,
  withDays: (days: number) => [...statsKeys.base, days] as const,
};

export function useStats(days = 30): UseQueryResult<StatsResponse> {
  return useQuery({
    queryKey: statsKeys.withDays(days),
    queryFn: () => apiGet<StatsResponse>(`/api/admin/stats?days=${days}`),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
