import { useEffect } from 'react';
import { Outlet } from 'react-router';

import { apiGet, ApiError } from '../api/client';
import type { AuthMeResponse } from '../lib/types';
import { useAuthStore } from '../store/authStore';
import { Spinner } from '../components/ui/Spinner';

/**
 * Fetchea /api/auth/me al montar y popula authStore.
 * Mientras carga muestra un loader fullscreen; si falla muestra el error.
 * En produccion con Entra ID habra que disparar MSAL login aqui si viene un 401;
 * en dev con DEV_BYPASS el backend siempre responde OK.
 */
export function AuthGuard() {
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setError = useAuthStore((s) => s.setError);

  useEffect(() => {
    let cancelled = false;
    setLoading();
    apiGet<AuthMeResponse>('/api/auth/me')
      .then((data) => {
        if (cancelled) return;
        setAuthenticated(data.user, data.forms);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'No se pudo iniciar sesion';
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [setAuthenticated, setError, setLoading]);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={32} />
          <p className="text-sm text-muted">Cargando sesion...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-bg-card border border-danger/30 rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-danger mb-2">No se pudo iniciar sesion</h1>
          <p className="text-sm text-muted mb-4">{error ?? 'Error desconocido'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-accent text-bg-primary font-medium hover:bg-accent/90 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
