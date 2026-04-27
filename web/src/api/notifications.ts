import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { apiGet, apiPost } from './client';

export type AdminNotification = {
  id: string;
  submission_id: string | null;
  kind: string;
  payload_json: string;
  sent_at: string | null;
  created_at: string;
};

export type NotificationsResponse = {
  ok: true;
  pending: AdminNotification[];
  lastSent: AdminNotification[];
  totals: { kind: string; _count: { _all: number } }[];
};

export const notificationsKeys = {
  all: ['admin', 'notifications'] as const,
};

/**
 * Refresca cada 5s para que el operador vea cuando el worker drena la cola
 * (intervalo > worker tick de 15s para no spamear, pero lo suficientemente
 * vivo para sentir que esta "vivo").
 */
export function useAdminNotifications(): UseQueryResult<NotificationsResponse> {
  return useQuery({
    queryKey: notificationsKeys.all,
    queryFn: () => apiGet<NotificationsResponse>('/api/admin/notifications'),
    staleTime: 0,
    refetchInterval: 5_000,
  });
}

export function useResendNotification(): UseMutationResult<unknown, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/api/admin/notifications/${id}/resend`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}
