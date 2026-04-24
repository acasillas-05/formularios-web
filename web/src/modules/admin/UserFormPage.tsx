import { ApiError } from '../../api/client';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  useCreateUser,
  useDeleteUser,
  useSetUserPermissions,
  useUpdateUser,
  useUser,
  useUserPermissions,
} from '../../api/admin';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FieldShell } from '../../components/ui/FieldShell';
import { Input } from '../../components/ui/Input';
import { RadioGroup } from '../../components/ui/RadioGroup';
import { Spinner } from '../../components/ui/Spinner';
import { FORM_ICONS } from '../formularios/formIcons';
import type { FormSlug, Rol } from '../../lib/types';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

const ROL_OPTIONS = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'jefe_de_patio', label: 'Jefe de Patio' },
  { value: 'operativo', label: 'Operativo' },
] as const;

const ADMIN_ONLY_META: { slug: FormSlug; title: string }[] = [
  { slug: 'eliminar-tara', title: 'Eliminar Tara' },
  { slug: 'registrar-proveedor', title: 'Registrar Proveedor' },
  { slug: 'habilitar-concat-rem', title: 'Habilitar Concatenado Remision Externa' },
  { slug: 'eliminar-entrada-lre', title: 'Eliminar Entrada LRE' },
  { slug: 'eliminar-salida-tara-lrs', title: 'Eliminar Salida - Tara - LRS' },
  { slug: 'permitir-pesaje-manual', title: 'Permitir Pesaje Manual' },
];

export function UserFormPage() {
  const { id } = useParams();
  const isCreate = !id;
  return isCreate ? <CreateUser /> : <EditUser id={id} />;
}

/* =========================================================
 * Create
 * ========================================================= */

function CreateUser() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('operativo');
  const create = useCreateUser();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    try {
      const user = await create.mutateAsync({ email: email.trim().toLowerCase(), nombre: nombre.trim(), rol });
      toast({ kind: 'success', title: 'Usuario creado', description: user.email });
      navigate(`/admin/users/${user.id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Error desconocido';
      toast({ kind: 'error', title: 'No se pudo crear', description: msg });
    }
  }

  return (
    <div className="max-w-xl mx-auto animate-fade-in-up">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-text mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Usuarios
      </Link>
      <h1 className="text-2xl font-bold text-text">Nuevo usuario</h1>
      <p className="text-sm text-muted mt-1 mb-6">
        Crea la cuenta ahora. El usuario podra entrar cuando haga login con su correo de Entra ID.
      </p>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldShell label="Email" required htmlFor="u-email">
            <Input
              id="u-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre.apellido@adnenergia.com"
              required
            />
          </FieldShell>
          <FieldShell label="Nombre" required htmlFor="u-nombre">
            <Input id="u-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={120} />
          </FieldShell>
          <FieldShell label="Rol" required>
            <RadioGroup
              name="rol"
              value={rol}
              onChange={(v) => setRol(v as Rol)}
              options={ROL_OPTIONS}
              columns={3}
            />
          </FieldShell>
          <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/users')}>
              Cancelar
            </Button>
            <Button type="submit" icon={Save} loading={create.isPending}>
              Crear usuario
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

/* =========================================================
 * Edit
 * ========================================================= */

function EditUser({ id }: { id: string }) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const detail = useUser(id);

  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('operativo');
  const [activo, setActivo] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (detail.data) {
      setNombre(detail.data.nombre);
      setRol(detail.data.rol);
      setActivo(detail.data.activo);
    }
  }, [detail.data]);

  const update = useUpdateUser(id);
  const del = useDeleteUser();

  if (detail.isPending) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-6 text-center">
          <p className="text-danger">No se pudo cargar el usuario.</p>
          <Link to="/admin/users" className="mt-4 inline-flex items-center gap-2 text-sm text-accent hover:underline">
            <ArrowLeft size={14} /> Volver
          </Link>
        </Card>
      </div>
    );
  }

  const user = detail.data;
  const isSelf = currentUser?.id === user.id;
  const dirty = nombre !== user.nombre || rol !== user.rol || activo !== user.activo;

  async function save(): Promise<void> {
    try {
      await update.mutateAsync({ nombre: nombre.trim(), rol, activo });
      toast({ kind: 'success', title: 'Usuario actualizado' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Error desconocido';
      toast({ kind: 'error', title: 'No se pudo actualizar', description: msg });
    }
  }

  async function confirmDeleteUser(): Promise<void> {
    try {
      await del.mutateAsync(user.id);
      toast({ kind: 'success', title: 'Usuario desactivado' });
      navigate('/admin/users');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Error desconocido';
      toast({ kind: 'error', title: 'No se pudo eliminar', description: msg });
      setConfirmDelete(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-text mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Usuarios
      </Link>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">{user.nombre}</h1>
          <p className="text-sm text-muted mt-1">{user.email}</p>
        </div>
        <Badge variant={user.activo ? 'success' : 'default'} dot>
          {user.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      <Card className="p-6 mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex flex-col gap-4"
        >
          <FieldShell label="Email" description="El email no se puede modificar (viene de Entra ID).">
            <Input value={user.email} disabled />
          </FieldShell>

          <FieldShell label="Nombre" required htmlFor="u-nombre">
            <Input id="u-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
          </FieldShell>

          <FieldShell label="Rol" required>
            <RadioGroup
              name="rol"
              value={rol}
              onChange={(v) => setRol(v as Rol)}
              options={ROL_OPTIONS}
              columns={3}
            />
          </FieldShell>

          <FieldShell label="Activo">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-accent)]"
              />
              <span className="text-sm text-muted">
                Permite que este usuario acceda a la plataforma.
              </span>
            </label>
          </FieldShell>

          <div className="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-border">
            <Button
              type="button"
              variant="danger"
              icon={Trash2}
              onClick={() => setConfirmDelete(true)}
              disabled={isSelf}
              title={isSelf ? 'No puedes eliminar tu propio usuario' : undefined}
            >
              Eliminar
            </Button>
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => navigate('/admin/users')}>
                Cancelar
              </Button>
              <Button type="submit" icon={Save} loading={update.isPending} disabled={!dirty}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {rol === 'jefe_de_patio' ? <PermissionsCard userId={user.id} /> : null}

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void confirmDeleteUser()}
        loading={del.isPending}
        title="Eliminar usuario"
        description={
          <>
            Vas a <span className="text-danger font-medium">desactivar</span> al usuario{' '}
            <span className="text-text font-medium">{user.email}</span>. Su historial de envios se conserva, pero ya no
            podra acceder ni aparecera en filtros activos. Esta accion es reversible reactivando la cuenta.
          </>
        }
      />
    </div>
  );
}

/* =========================================================
 * Permisos extra para jefe_de_patio
 * ========================================================= */

function PermissionsCard({ userId }: { userId: string }) {
  const query = useUserPermissions(userId);
  const mutate = useSetUserPermissions(userId);
  const [selected, setSelected] = useState<Set<FormSlug>>(new Set());

  useEffect(() => {
    if (query.data) setSelected(new Set(query.data.formSlugs));
  }, [query.data]);

  const currentServer = useMemo(() => new Set(query.data?.formSlugs ?? []), [query.data]);
  const dirty = useMemo(() => {
    if (selected.size !== currentServer.size) return true;
    for (const s of selected) if (!currentServer.has(s)) return true;
    return false;
  }, [selected, currentServer]);

  function toggle(slug: FormSlug): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function save(): Promise<void> {
    try {
      await mutate.mutateAsync(Array.from(selected));
      toast({ kind: 'success', title: 'Permisos actualizados' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Error desconocido';
      toast({ kind: 'error', title: 'No se pudo guardar', description: msg });
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text">Permisos extra (Jefe de Patio)</h2>
        <p className="text-sm text-muted mt-1">
          Marca los formularios adicionales que este jefe de patio podra enviar. Los 5 formularios operativos los
          tiene por default.
        </p>
      </div>

      {query.isPending ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size={24} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ADMIN_ONLY_META.map((item) => {
            const Icon = FORM_ICONS[item.slug];
            const checked = selected.has(item.slug);
            return (
              <label
                key={item.slug}
                className={
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ' +
                  (checked
                    ? 'border-accent bg-accent/10 text-text'
                    : 'border-border bg-bg-surface text-muted hover:border-accent/40 hover:text-text')
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(item.slug)}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
                <Icon size={16} className={checked ? 'text-accent' : 'text-muted'} />
                <span className="truncate">{item.title}</span>
              </label>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-border">
        <Button
          variant="secondary"
          onClick={() => setSelected(new Set(currentServer))}
          disabled={!dirty || mutate.isPending}
        >
          Revertir
        </Button>
        <Button icon={Save} onClick={() => void save()} loading={mutate.isPending} disabled={!dirty}>
          Guardar permisos
        </Button>
      </div>
    </Card>
  );
}
