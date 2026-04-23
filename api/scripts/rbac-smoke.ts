/**
 * Smoke test de RBAC: muta temporalmente el rol del admin en la BD,
 * deja que el proximo GET /api/auth/me lo refleje (auth middleware lee vivo),
 * y restaura. Uso solo desde CLI: tsx scripts/rbac-smoke.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ADMIN_EMAIL = 'operacionesadn@adnenergia.com';
const API = 'http://localhost:3001';

async function meForms(): Promise<{ rol: string; count: number; slugs: string[] }> {
  const res = await fetch(`${API}/api/auth/me`);
  if (!res.ok) throw new Error(`me returned ${res.status}`);
  const body = (await res.json()) as {
    user: { rol: string };
    forms: { slug: string }[];
  };
  return {
    rol: body.user.rol,
    count: body.forms.length,
    slugs: body.forms.map((f) => f.slug),
  };
}

async function setRol(rol: string): Promise<string> {
  const u = await prisma.usuario.update({
    where: { email: ADMIN_EMAIL },
    data: { rol },
  });
  return u.id;
}

async function main(): Promise<void> {
  try {
    console.log('--- escenario 1: administrador (default) ---');
    await setRol('administrador');
    console.log(await meForms());

    console.log('\n--- escenario 2: operativo (solo 5 slugs base) ---');
    await setRol('operativo');
    console.log(await meForms());

    console.log('\n--- escenario 3: jefe_de_patio sin extras (5 slugs) ---');
    const userId = await setRol('jefe_de_patio');
    await prisma.usuarioFormPermiso.deleteMany({ where: { usuario_id: userId } });
    console.log(await meForms());

    console.log('\n--- escenario 4: jefe_de_patio + 2 extras (7 slugs) ---');
    await prisma.usuarioFormPermiso.createMany({
      data: [
        { usuario_id: userId, form_slug: 'eliminar-tara', created_by: 'test' },
        { usuario_id: userId, form_slug: 'permitir-pesaje-manual', created_by: 'test' },
      ],
    });
    console.log(await meForms());

    console.log('\n--- cleanup: restaurar admin ---');
    await prisma.usuarioFormPermiso.deleteMany({ where: { usuario_id: userId } });
    await setRol('administrador');
    console.log(await meForms());
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
