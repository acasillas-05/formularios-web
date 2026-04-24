/**
 * Smoke test de los endpoints /api/admin/*.
 * Crea un usuario sintetico, lo actualiza, le asigna permisos,
 * consulta submissions, y lo elimina (soft delete).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = 'http://localhost:3001';
const TEST_EMAIL = 'smoke-test-user@adnenergia.com';

type Res<T> = { status: number; data: T };

async function apiGet<T>(path: string): Promise<Res<T>> {
  const res = await fetch(`${API}${path}`);
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

async function apiPost<T>(path: string, body: unknown): Promise<Res<T>> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

async function apiPatch<T>(path: string, body: unknown): Promise<Res<T>> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

async function apiPut<T>(path: string, body: unknown): Promise<Res<T>> {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

async function apiDelete<T>(path: string): Promise<Res<T>> {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

type ScenarioCtx = { userId?: string };
type Scenario = { name: string; run: (ctx: ScenarioCtx) => Promise<void> };

async function cleanupBefore(): Promise<void> {
  await prisma.usuarioFormPermiso.deleteMany({
    where: { usuario: { email: TEST_EMAIL } },
  });
  await prisma.usuario.deleteMany({ where: { email: TEST_EMAIL } });
}

async function main(): Promise<void> {
  let failed = 0;
  const ctx: ScenarioCtx = {};

  await cleanupBefore();

  const scenarios: Scenario[] = [
    {
      name: 'POST /admin/users crea usuario operativo',
      async run() {
        const r = await apiPost<{ usuario: { id: string; email: string; rol: string } }>('/api/admin/users', {
          email: TEST_EMAIL,
          nombre: 'Smoke Test',
          rol: 'operativo',
        });
        if (r.status !== 201) throw new Error(`esperaba 201, vino ${r.status}: ${JSON.stringify(r.data)}`);
        if (r.data.usuario.rol !== 'operativo') throw new Error('rol no se asigno');
        ctx.userId = r.data.usuario.id;
      },
    },
    {
      name: 'POST /admin/users duplicado devuelve 409',
      async run() {
        const r = await apiPost<{ error: string }>('/api/admin/users', {
          email: TEST_EMAIL,
          nombre: 'Smoke',
          rol: 'operativo',
        });
        if (r.status !== 409) throw new Error(`esperaba 409, vino ${r.status}`);
      },
    },
    {
      name: 'GET /admin/users?rol=operativo incluye al nuevo',
      async run() {
        const r = await apiGet<{ usuarios: { email: string }[] }>('/api/admin/users?rol=operativo');
        if (r.status !== 200) throw new Error(`esperaba 200, vino ${r.status}`);
        if (!r.data.usuarios.some((u) => u.email === TEST_EMAIL)) throw new Error('usuario no aparece en lista');
      },
    },
    {
      name: 'PATCH /admin/users/:id promueve a jefe_de_patio',
      async run() {
        if (!ctx.userId) throw new Error('sin userId');
        const r = await apiPatch<{ usuario: { rol: string } }>(`/api/admin/users/${ctx.userId}`, {
          rol: 'jefe_de_patio',
        });
        if (r.status !== 200) throw new Error(`esperaba 200, vino ${r.status}`);
        if (r.data.usuario.rol !== 'jefe_de_patio') throw new Error('rol no cambio');
      },
    },
    {
      name: 'PUT /admin/users/:id/permissions asigna 2 extras',
      async run() {
        if (!ctx.userId) throw new Error('sin userId');
        const r = await apiPut<{ formSlugs: string[] }>(`/api/admin/users/${ctx.userId}/permissions`, {
          formSlugs: ['eliminar-tara', 'permitir-pesaje-manual'],
        });
        if (r.status !== 200) throw new Error(`esperaba 200, vino ${r.status}`);
        if (r.data.formSlugs.length !== 2) throw new Error('no se asignaron los 2 permisos');
      },
    },
    {
      name: 'GET /admin/users/:id/permissions devuelve availableSlugs + 2 asignados',
      async run() {
        if (!ctx.userId) throw new Error('sin userId');
        const r = await apiGet<{ formSlugs: string[]; availableSlugs: string[] }>(
          `/api/admin/users/${ctx.userId}/permissions`,
        );
        if (r.status !== 200) throw new Error(`esperaba 200, vino ${r.status}`);
        if (r.data.formSlugs.length !== 2) throw new Error(`esperaba 2, vino ${r.data.formSlugs.length}`);
        if (r.data.availableSlugs.length !== 6) throw new Error(`availableSlugs debe ser 6, vino ${r.data.availableSlugs.length}`);
      },
    },
    {
      name: 'PUT permissions con slug de operativo -> 400',
      async run() {
        if (!ctx.userId) throw new Error('sin userId');
        const r = await apiPut<{ error: string }>(`/api/admin/users/${ctx.userId}/permissions`, {
          formSlugs: ['placa-remolque'],
        });
        if (r.status !== 400) throw new Error(`esperaba 400, vino ${r.status}`);
      },
    },
    {
      name: 'PATCH degrada a operativo -> permisos extra se limpian',
      async run() {
        if (!ctx.userId) throw new Error('sin userId');
        await apiPatch(`/api/admin/users/${ctx.userId}`, { rol: 'operativo' });
        const count = await prisma.usuarioFormPermiso.count({ where: { usuario_id: ctx.userId } });
        if (count !== 0) throw new Error(`esperaba 0 permisos tras demotion, hay ${count}`);
      },
    },
    {
      name: 'GET /admin/submissions?limit=5 pagina primeros 5',
      async run() {
        const r = await apiGet<{ total: number; limit: number; submissions: unknown[] }>('/api/admin/submissions?limit=5');
        if (r.status !== 200) throw new Error(`esperaba 200, vino ${r.status}`);
        if (r.data.limit !== 5) throw new Error(`limit esperado 5, vino ${r.data.limit}`);
        if (r.data.submissions.length > 5) throw new Error('devolvio mas de 5 filas');
      },
    },
    {
      name: 'DELETE /admin/users/:id hace soft delete',
      async run() {
        if (!ctx.userId) throw new Error('sin userId');
        const r = await apiDelete(`/api/admin/users/${ctx.userId}`);
        if (r.status !== 200) throw new Error(`esperaba 200, vino ${r.status}`);
        const row = await prisma.usuario.findUnique({ where: { id: ctx.userId } });
        if (!row) throw new Error('usuario fisicamente borrado (deberia ser soft)');
        if (row.activo !== false) throw new Error('activo deberia ser false');
        if (!row.deleted_at) throw new Error('deleted_at no se seteo');
      },
    },
    {
      name: 'GET /admin/users/:id despues de delete -> 404',
      async run() {
        if (!ctx.userId) throw new Error('sin userId');
        const r = await apiGet(`/api/admin/users/${ctx.userId}`);
        if (r.status !== 404) throw new Error(`esperaba 404, vino ${r.status}`);
      },
    },
  ];

  for (const s of scenarios) {
    try {
      await s.run(ctx);
      console.log(`  OK   ${s.name}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  FAIL ${s.name}`);
      console.log(`       ${msg}`);
    }
  }

  await cleanupBefore();
  await prisma.$disconnect();

  console.log(`\n--- ${scenarios.length - failed}/${scenarios.length} OK ---`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
