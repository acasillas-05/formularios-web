import { useEffect, useState } from 'react';

type HealthResponse = {
  ok: boolean;
  service: string;
  env: string;
  timestamp: string;
};

type ApiState =
  | { status: 'loading' }
  | { status: 'ok'; data: HealthResponse }
  | { status: 'error'; message: string };

export function App() {
  const [state, setState] = useState<ApiState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as HealthResponse;
        setState({ status: 'ok', data });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setState({ status: 'error', message });
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary text-text flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-bg-card border border-border rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-1">Formularios ADN</h1>
        <p className="text-sm text-muted mb-5">Plataforma operativa — bootstrap inicial</p>

        <div className="flex items-center gap-2 mb-2 text-sm">
          <span className="text-muted">Estado del API:</span>
          {state.status === 'loading' && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border bg-bg-surface text-muted border-border">
              Verificando...
            </span>
          )}
          {state.status === 'ok' && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border bg-success/12 text-success border-success/28">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Operativo
            </span>
          )}
          {state.status === 'error' && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border bg-danger/12 text-danger border-danger/28">
              <span className="w-1.5 h-1.5 rounded-full bg-danger" />
              Sin conexion
            </span>
          )}
        </div>

        {state.status === 'ok' && (
          <dl className="font-mono text-xs text-muted grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mt-4 pt-4 border-t border-border">
            <dt>service</dt>
            <dd className="text-text">{state.data.service}</dd>
            <dt>env</dt>
            <dd className="text-text">{state.data.env}</dd>
            <dt>timestamp</dt>
            <dd className="text-text">{state.data.timestamp}</dd>
          </dl>
        )}

        {state.status === 'error' && (
          <p className="text-xs text-danger mt-4 pt-4 border-t border-border">
            {state.message}. Asegurate de que el API este corriendo (npm run dev:api).
          </p>
        )}
      </div>
    </div>
  );
}
