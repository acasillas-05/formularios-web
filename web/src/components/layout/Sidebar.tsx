import {
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router';

import { cn } from '../../lib/cn';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';

type NavItem = { to: string; icon: LucideIcon; label: string; disabled?: boolean; adminOnly?: boolean };
type NavGroup = { label: string; items: NavItem[]; adminOnly?: boolean };

const GROUPS: NavGroup[] = [
  {
    label: 'Operacion',
    items: [
      { to: '/formularios', icon: FileText, label: 'Formularios' },
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', adminOnly: true },
    ],
  },
  {
    label: 'Administracion',
    adminOnly: true,
    items: [
      { to: '/admin/users', icon: Users, label: 'Usuarios' },
      { to: '/admin/auditoria', icon: History, label: 'Auditoria' },
      { to: '/admin/notifications', icon: Bell, label: 'Notificaciones' },
    ],
  },
];

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggle = useAppStore((s) => s.toggleSidebar);
  const rol = useAuthStore((s) => s.user?.rol);
  const isAdmin = rol === 'administrador';

  const visibleGroups = GROUPS.filter((g) => !g.adminOnly || isAdmin);

  return (
    <aside
      className={cn(
        'bg-bg-card border-r border-border flex flex-col shrink-0',
        'transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[250px]',
      )}
    >
      <div className="h-16 flex items-center px-4 border-b border-border">
        {collapsed ? (
          <div className="w-8 h-8 rounded-md bg-accent/15 flex items-center justify-center mx-auto">
            <span className="text-accent font-bold text-sm tracking-tight">FW</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-md bg-accent/15 flex items-center justify-center shrink-0">
              <span className="text-accent font-bold text-sm tracking-tight">FW</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-text leading-tight truncate">Formularios</div>
              <div className="text-xs text-muted leading-tight truncate">ADN Energia</div>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            {!collapsed ? (
              <div className="px-4 mb-2 text-xs uppercase tracking-wider text-muted/60">
                {group.label}
              </div>
            ) : (
              <div className="mx-auto mb-2 w-6 h-px bg-border" />
            )}
            <ul className="flex flex-col gap-0.5 px-2">
              {group.items
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => (
                <li key={item.to}>
                  {item.disabled ? (
                    <div
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                        'text-muted/40 cursor-not-allowed',
                        collapsed && 'justify-center',
                      )}
                      title={`${item.label} (proximamente)`}
                    >
                      <item.icon size={20} />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </div>
                  ) : (
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                          'border-l-2',
                          isActive
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-transparent text-muted hover:bg-bg-surface/50 hover:text-text',
                          collapsed && 'justify-center border-l-0',
                        )
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon size={20} />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={toggle}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm',
            'text-muted hover:text-text hover:bg-bg-surface/50 transition-colors',
          )}
          aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
        >
          {collapsed ? (
            <ChevronRight size={18} />
          ) : (
            <>
              <ChevronLeft size={18} />
              <span>Colapsar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
