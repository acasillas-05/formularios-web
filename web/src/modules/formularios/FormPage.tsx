import { ArrowLeft, Construction } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { Card } from '../../components/ui/Card';
import { isFormSlugLike } from '../../lib/isFormSlug';
import { useAuthStore } from '../../store/authStore';

/**
 * Placeholder de Fase 5: la ruta existe y valida permiso via authStore.forms,
 * pero el renderer real del formulario se implementa en Fase 6.
 */
export function FormPage() {
  const { slug = '' } = useParams();
  const forms = useAuthStore((s) => s.forms);
  const match = isFormSlugLike(slug) ? forms.find((f) => f.slug === slug) : undefined;

  if (!match) {
    return (
      <div className="max-w-xl mx-auto animate-fade-in-up">
        <Card className="p-8 text-center">
          <h1 className="text-lg font-semibold text-danger mb-2">Formulario no disponible</h1>
          <p className="text-sm text-muted mb-4">
            El formulario <code className="font-mono text-muted/80">{slug}</code> no existe o no tienes permiso para verlo.
          </p>
          <Link
            to="/formularios"
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            <ArrowLeft size={14} /> Volver al listado
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <Link
        to="/formularios"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-text mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Formularios
      </Link>
      <h1 className="text-2xl font-bold text-text">{match.title}</h1>
      <p className="text-sm text-muted mt-1 mb-6">{match.subtitle}</p>

      <Card className="p-6">
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-12 h-12 rounded-full bg-warning/12 flex items-center justify-center text-warning mb-3">
            <Construction size={24} />
          </div>
          <h2 className="text-base font-medium text-text">Renderer en construccion</h2>
          <p className="text-sm text-muted mt-1.5 max-w-sm">
            El renderer declarativo de formularios se implementa en la Fase 6.
            El backend ya ejecuta este formulario correctamente vía <code className="font-mono">POST /api/forms/{slug}/submit</code>.
          </p>
        </div>
      </Card>
    </div>
  );
}
