import { Plus, Search, UserCog } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useUsers, type AdminUser, type UsersFilter } from '../../api/admin';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, type Column } from '../../components/ui/Table';
import type { Rol } from '../../lib/types';

const ROL_LABELS: Record<Rol, string> = {
  administrador: 'Administrador',
  jefe_de_patio: 'Jefe de Patio',
  operativo: 'Operativo',
};

const ROL_VARIANTS: Record<Rol, 'cyan' | 'blue' | 'default'> = {
  administrador: 'cyan',
  jefe_de_patio: 'blue',
  operativo: 'default',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function UsersPage() {
  const [rol, setRol] = useState<Rol | ''>('');
  const [activoFilter, setActivoFilter] = useState<'all' | 'true' | 'false'>('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filter: UsersFilter = {
    ...(rol ? { rol } : {}),
    ...(activoFilter !== 'all' ? { activo: activoFilter === 'true' } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const query = useUsers(filter);

  const columns: Column<AdminUser>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (u) => (
        <div className="min-w-0">
          <div className="font-medium text-text truncate">{u.nombre}</div>
          <div className="text-xs text-muted mt-0.5 truncate">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'rol',
      header: 'Rol',
      width: '160px',
      render: (u) => <Badge variant={ROL_VARIANTS[u.rol]} dot>{ROL_LABELS[u.rol]}</Badge>,
    },
    {
      key: 'activo',
      header: 'Estado',
      width: '120px',
      render: (u) =>
        u.activo ? (
          <Badge variant="success" dot>Activo</Badge>
        ) : (
          <Badge variant="default" dot>Inactivo</Badge>
        ),
    },
    {
      key: 'permisosExtra',
      header: 'Permisos extra',
      width: '140px',
      align: 'right',
      render: (u) => (
        <span className="font-mono text-xs tabular-nums text-muted">
          {u._count?.permisosExtra ?? 0}
        </span>
      ),
    },
    {
      key: 'submissions',
      header: 'Envios',
      width: '100px',
      align: 'right',
      render: (u) => (
        <span className="font-mono text-xs tabular-nums text-muted">
          {u._count?.submissions ?? 0}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Alta',
      width: '120px',
      render: (u) => <span className="text-xs text-muted">{formatDate(u.created_at)}</span>,
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Usuarios</h1>
          <p className="text-sm text-muted mt-1">Gestion de cuentas y permisos de la plataforma.</p>
        </div>
        <Button icon={Plus} onClick={() => navigate('/admin/users/new')}>
          Nuevo usuario
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_180px] gap-3 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={rol}
          onChange={(e) => setRol(e.target.value as Rol | '')}
          options={[
            { value: '', label: 'Todos los roles' },
            { value: 'administrador', label: 'Administrador' },
            { value: 'jefe_de_patio', label: 'Jefe de Patio' },
            { value: 'operativo', label: 'Operativo' },
          ]}
        />
        <Select
          value={activoFilter}
          onChange={(e) => setActivoFilter(e.target.value as 'all' | 'true' | 'false')}
          options={[
            { value: 'all', label: 'Activos e inactivos' },
            { value: 'true', label: 'Solo activos' },
            { value: 'false', label: 'Solo inactivos' },
          ]}
        />
      </div>

      <Table
        columns={columns}
        rows={query.data ?? []}
        getRowKey={(u) => u.id}
        onRowClick={(u) => navigate(`/admin/users/${u.id}`)}
        isLoading={query.isPending}
        emptyTitle="Sin usuarios"
        emptyDescription="No hay usuarios que coincidan con los filtros."
      />

      {query.isError ? (
        <div className="mt-3 text-sm text-danger flex items-center gap-2">
          <UserCog size={14} /> Error al cargar usuarios. Intenta refrescar.
        </div>
      ) : null}
    </div>
  );
}
