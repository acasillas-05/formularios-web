import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router';

import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/authStore';
import { FORM_ICONS } from './formIcons';

export function FormsListPage() {
  const forms = useAuthStore((s) => s.forms);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  if (forms.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Sin formularios disponibles"
        description="No hay formularios habilitados para tu rol. Contacta al administrador."
      />
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Formularios</h1>
          <p className="text-sm text-muted mt-1">
            {user ? `Hola ${user.nombre.split(' ')[0]}, ` : ''}
            tienes {forms.length} {forms.length === 1 ? 'formulario disponible' : 'formularios disponibles'}.
          </p>
        </div>
        <Badge variant="cyan" dot>
          {forms.length} total
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {forms.map((form) => {
          const Icon = FORM_ICONS[form.slug];
          return (
            <Card
              key={form.slug}
              interactive
              onClick={() => navigate(`/formularios/${form.slug}`)}
              className="p-5 flex flex-col gap-3 h-full"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-text leading-snug">{form.title}</h2>
                <p className="text-sm text-muted mt-1.5 line-clamp-3">{form.subtitle}</p>
              </div>
              <div className="text-xs font-mono text-muted/60 truncate">{form.slug}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
