import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { CatalogoResponse, CatalogoSlug } from '../lib/types';
import { apiGet } from './client';

export const catalogoKeys = {
  all: ['catalogos'] as const,
  one: (slug: CatalogoSlug) => [...catalogoKeys.all, slug] as const,
};

/**
 * Lee un catalogo del backend. Cache relativamente largo porque los
 * catalogos cambian con poca frecuencia (proveedores, destinos, etc.).
 */
export function useCatalogo(slug: CatalogoSlug): UseQueryResult<CatalogoResponse> {
  return useQuery({
    queryKey: catalogoKeys.one(slug),
    queryFn: () => apiGet<CatalogoResponse>(`/api/catalogos/${slug}`),
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
