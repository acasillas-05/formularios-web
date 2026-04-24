import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto text-center py-24 animate-fade-in-up">
      <div className="text-4xl font-bold text-accent mb-2">404</div>
      <h1 className="text-lg font-semibold text-text mb-2">Pagina no encontrada</h1>
      <p className="text-sm text-muted mb-6">La ruta que intentas abrir no existe.</p>
      <Link
        to="/formularios"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-surface text-text border border-border hover:border-accent/40 transition-colors text-sm"
      >
        <ArrowLeft size={14} /> Ir a Formularios
      </Link>
    </div>
  );
}
