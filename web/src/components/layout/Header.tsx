import { LogOut, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { Badge } from '../ui/Badge';

function initialsFrom(name: string, email: string): string {
  const base = name.trim() || email;
  const parts = base.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

const ROL_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  jefe_de_patio: 'Jefe de Patio',
  operativo: 'Operativo',
};

export function Header() {
  const user = useAuthStore((s) => s.user);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!user) {
    // AuthGuard deberia prevenir esto. Defensa: placeholder invisible para no romper layout.
    return <header className="h-16 bg-bg-card border-b border-border" />;
  }

  const rolLabel = ROL_LABELS[user.rol] ?? user.rol;

  return (
    <header className="h-16 bg-bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
      <div />

      <div className="flex items-center gap-3" ref={menuRef}>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-muted hover:text-text hover:bg-bg-surface/60 transition-colors"
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2.5 px-2 py-1.5 rounded-md',
              'hover:bg-bg-surface/60 transition-colors',
            )}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xs font-semibold">
              {initialsFrom(user.nombre, user.email)}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-tight min-w-0">
              <span className="text-sm text-text truncate max-w-[180px]">{user.nombre}</span>
              <Badge variant="cyan" dot className="mt-0.5">{rolLabel}</Badge>
            </div>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 bg-bg-card border border-border rounded-xl shadow-xl shadow-black/50 overflow-hidden animate-fade-in z-50"
            >
              <div className="px-4 py-3 border-b border-border">
                <div className="text-sm font-medium text-text truncate">{user.nombre}</div>
                <div className="text-xs text-muted mt-0.5 truncate">{user.email}</div>
                <div className="mt-2">
                  <Badge variant="cyan" dot>{rolLabel}</Badge>
                </div>
              </div>
              <button
                disabled
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted/60 cursor-not-allowed"
                title="Disponible cuando se integre MSAL en produccion"
              >
                <LogOut size={16} />
                Cerrar sesion
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
