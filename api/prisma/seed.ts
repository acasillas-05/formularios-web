/**
 * Seed idempotente de la BD plataforma.
 * Crea (o mantiene) al admin principal. Los demas usuarios entran via
 * auto-provision en el primer login con Entra ID, o los crea el admin
 * desde la UI de /admin/users (Fase 7).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'operacionesadn@adnenergia.com';
const ADMIN_NOMBRE = 'Operaciones ADN';

async function main(): Promise<void> {
  const admin = await prisma.usuario.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      rol: 'administrador',
      activo: true,
      deleted_at: null,
    },
    create: {
      email: ADMIN_EMAIL,
      nombre: ADMIN_NOMBRE,
      rol: 'administrador',
    },
  });

  console.log(`[seed] admin listo: ${admin.email} (id=${admin.id})`);
}

main()
  .catch((err: unknown) => {
    console.error('[seed] error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
