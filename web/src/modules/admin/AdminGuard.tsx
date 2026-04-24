import { ShieldAlert } from 'lucide-react';
import { Link, Outlet } from 'react-router';

import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';

/**
 * Protege las rutas /admin/*. Si el usuario no es administrador,
 * muestra un estado 403 en lugar de redirigir silenciosamente.
 */
export function AdminGuard() {
  const rol = useAuthStore((s) => s.user?.rol);

  if (rol !== 'administrador') {
    return (
      <div className="max-w-xl mx-auto animate-fade-in-up">
        <Card className="p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-danger/15 flex items-center justify-center text-danger mx-auto mb-3">
            <ShieldAlert size={24} />
          </div>
          <h1 className="text-lg font-semibold text-text mb-2">Acceso restringido</h1>
          <p className="text-sm text-muted mb-4">
            Esta seccion es solo para administradores. Si crees que deberias tener acceso, contacta al equipo de
            plataforma.
          </p>
          <Link to="/formularios" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
            Volver a Formularios
          </Link>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
