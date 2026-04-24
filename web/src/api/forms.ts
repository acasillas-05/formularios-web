import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';

import type { FormPublicDefinition, FormSlug } from '../lib/types';
import { apiGet, apiPost } from './client';

type FormDetailResponse = {
  ok: true;
  form: FormPublicDefinition;
};

export type SubmitResponse = {
  ok: true;
  status: number | null;
  submissionId: string;
  successMessage: string;
  output: Record<string, unknown>;
  recordset: unknown;
  durationMs: number;
};

export const formsKeys = {
  all: ['forms'] as const,
  detail: (slug: FormSlug) => [...formsKeys.all, slug] as const,
};

export function useFormDefinition(slug: FormSlug): UseQueryResult<FormPublicDefinition> {
  return useQuery({
    queryKey: formsKeys.detail(slug),
    queryFn: async () => {
      const res = await apiGet<FormDetailResponse>(`/api/forms/${slug}`);
      return res.form;
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useSubmitForm(
  slug: FormSlug,
): UseMutationResult<SubmitResponse, Error, Record<string, unknown>> {
  return useMutation({
    mutationFn: (body) => apiPost<SubmitResponse>(`/api/forms/${slug}/submit`, body),
  });
}
