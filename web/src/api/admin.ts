import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { FormSlug, Rol } from '../lib/types';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client';

export type AdminUser = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
  updated_at: string;
  _count?: { permisosExtra: number; submissions: number };
};

export type AdminUserDetail = AdminUser & {
  permisosExtra: { form_slug: FormSlug; created_at: string; created_by: string }[];
};

export type UsersFilter = {
  rol?: Rol;
  activo?: boolean;
  search?: string;
};

function filtersToQuery(f: UsersFilter): string {
  const sp = new URLSearchParams();
  if (f.rol) sp.set('rol', f.rol);
  if (f.activo !== undefined) sp.set('activo', String(f.activo));
  if (f.search) sp.set('search', f.search);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const adminKeys = {
  all: ['admin'] as const,
  users: (f: UsersFilter) => [...adminKeys.all, 'users', f] as const,
  user: (id: string) => [...adminKeys.all, 'user', id] as const,
  permissions: (id: string) => [...adminKeys.all, 'permissions', id] as const,
  submissions: (params: SubmissionsFilter) => [...adminKeys.all, 'submissions', params] as const,
  submission: (id: string) => [...adminKeys.all, 'submission', id] as const,
};

/* ---------------- users ---------------- */

export function useUsers(filter: UsersFilter): UseQueryResult<AdminUser[]> {
  return useQuery({
    queryKey: adminKeys.users(filter),
    queryFn: async () => {
      const res = await apiGet<{ usuarios: AdminUser[] }>(`/api/admin/users${filtersToQuery(filter)}`);
      return res.usuarios;
    },
    staleTime: 30 * 1000,
  });
}

export function useUser(id: string | undefined): UseQueryResult<AdminUserDetail> {
  return useQuery({
    queryKey: adminKeys.user(id ?? ''),
    queryFn: async () => {
      const res = await apiGet<{ usuario: AdminUserDetail }>(`/api/admin/users/${id}`);
      return res.usuario;
    },
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export type CreateUserBody = { email: string; nombre: string; rol: Rol };

export function useCreateUser(): UseMutationResult<AdminUser, Error, CreateUserBody> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await apiPost<{ usuario: AdminUser }>('/api/admin/users', body);
      return res.usuario;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

export type UpdateUserBody = { nombre?: string; rol?: Rol; activo?: boolean };

export function useUpdateUser(
  id: string,
): UseMutationResult<AdminUser, Error, UpdateUserBody> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await apiPatch<{ usuario: AdminUser }>(`/api/admin/users/${id}`, body);
      return res.usuario;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

export function useDeleteUser(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await apiDelete(`/api/admin/users/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

/* ---------------- permissions ---------------- */

export type UserPermissionsResponse = {
  ok: true;
  formSlugs: FormSlug[];
  availableSlugs: readonly FormSlug[];
};

export function useUserPermissions(id: string | undefined): UseQueryResult<UserPermissionsResponse> {
  return useQuery({
    queryKey: adminKeys.permissions(id ?? ''),
    queryFn: () => apiGet<UserPermissionsResponse>(`/api/admin/users/${id}/permissions`),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export function useSetUserPermissions(
  id: string,
): UseMutationResult<UserPermissionsResponse, Error, FormSlug[]> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formSlugs) => apiPut<UserPermissionsResponse>(`/api/admin/users/${id}/permissions`, { formSlugs }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

/* ---------------- submissions ---------------- */

export type SubmissionRow = {
  id: string;
  usuario_email: string;
  form_slug: FormSlug;
  sp_name: string;
  result: 'ok' | 'error';
  error_message: string | null;
  duration_ms: number;
  created_at: string;
};

export type SubmissionsFilter = {
  formSlug?: FormSlug;
  usuarioId?: string;
  result?: 'ok' | 'error';
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
};

export type SubmissionsResponse = {
  ok: true;
  total: number;
  limit: number;
  offset: number;
  submissions: SubmissionRow[];
};

function submissionsQuery(f: SubmissionsFilter): string {
  const sp = new URLSearchParams();
  if (f.formSlug) sp.set('formSlug', f.formSlug);
  if (f.usuarioId) sp.set('usuarioId', f.usuarioId);
  if (f.result) sp.set('result', f.result);
  if (f.desde) sp.set('desde', f.desde);
  if (f.hasta) sp.set('hasta', f.hasta);
  if (f.limit) sp.set('limit', String(f.limit));
  if (f.offset !== undefined) sp.set('offset', String(f.offset));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function useSubmissions(filter: SubmissionsFilter): UseQueryResult<SubmissionsResponse> {
  return useQuery({
    queryKey: adminKeys.submissions(filter),
    queryFn: () => apiGet<SubmissionsResponse>(`/api/admin/submissions${submissionsQuery(filter)}`),
    staleTime: 30 * 1000,
  });
}

export type SubmissionDetail = SubmissionRow & {
  usuario_id: string;
  payload_json: string;
};

export function useSubmission(id: string | undefined): UseQueryResult<SubmissionDetail> {
  return useQuery({
    queryKey: adminKeys.submission(id ?? ''),
    queryFn: async () => {
      const res = await apiGet<{ submission: SubmissionDetail }>(`/api/admin/submissions/${id}`);
      return res.submission;
    },
    enabled: Boolean(id),
  });
}
