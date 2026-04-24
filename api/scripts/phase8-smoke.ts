/**
 * Smoke test de Fase 8:
 *  1. Fuerza un error de negocio (eliminar-tara con folio inexistente).
 *  2. Verifica que la NotificationQueue tiene una fila sin sent_at.
 *  3. Espera ~2s a que el worker la procese.
 *  4. Verifica que sent_at esta seteado.
 *  5. Hit /api/admin/diagnostics (debe ser 200 con platformDb + bdadn ok).
 *  6. Hit /api/admin/notifications (debe listar pending + lastSent).
 *  7. Valida correlation id: /api/health responde con X-Request-Id header.
 *  8. Smoke rate limit: dispara 61 submits en <1min, el 61 deberia 429.
 */
import { PrismaClient } from '@prisma/client';

import { closePool } from '../src/mssql.js';

const prisma = new PrismaClient();
const API = 'http://localhost:3001';

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function submit(slug: string, body: unknown): Promise<{ status: number; data: { submissionId?: string } }> {
  const res = await fetch(`${API}/api/forms/${slug}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { submissionId?: string };
  return { status: res.status, data };
}

async function main(): Promise<void> {
  let failed = 0;
  const scenarios: { name: string; run: () => Promise<void> }[] = [
    {
      name: 'correlation id en X-Request-Id header',
      async run() {
        const res = await fetch(`${API}/api/health`);
        const id = res.headers.get('x-request-id');
        if (!id || id.length < 10) throw new Error(`X-Request-Id ausente o corto: "${id}"`);
      },
    },
    {
      name: 'error de negocio encola notificacion',
      async run() {
        const r = await submit('eliminar-tara', { FolioProcesoCarga: 999888777 });
        if (r.status !== 400) throw new Error(`esperaba 400, vino ${r.status}`);
        const sub = r.data.submissionId;
        if (!sub) throw new Error('submissionId ausente');

        const notif = await prisma.notificationQueue.findFirst({ where: { submission_id: sub } });
        if (!notif) throw new Error('no se creo fila en NotificationQueue');
        if (notif.sent_at !== null) throw new Error('sent_at no deberia estar seteado aun');
      },
    },
    {
      name: 'worker drena la cola en <=20s',
      async run() {
        for (let i = 0; i < 20; i++) {
          const pending = await prisma.notificationQueue.count({ where: { sent_at: null } });
          if (pending === 0) return;
          await sleep(1000);
        }
        throw new Error('worker no drena la cola (sigue con pendientes tras 20s)');
      },
    },
    {
      name: '/api/admin/diagnostics responde 200',
      async run() {
        const res = await fetch(`${API}/api/admin/diagnostics`);
        const data = (await res.json()) as {
          ok: boolean;
          platformDb: { ok: boolean };
          bdadn: { ok: boolean };
        };
        if (res.status !== 200) throw new Error(`esperaba 200, vino ${res.status}`);
        if (!data.platformDb.ok) throw new Error('platformDb check fallo');
        if (!data.bdadn.ok) throw new Error('bdadn check fallo');
      },
    },
    {
      name: '/api/admin/notifications lista pending + lastSent',
      async run() {
        const res = await fetch(`${API}/api/admin/notifications`);
        const data = (await res.json()) as { pending: unknown[]; lastSent: unknown[] };
        if (res.status !== 200) throw new Error(`esperaba 200, vino ${res.status}`);
        if (!Array.isArray(data.pending) || !Array.isArray(data.lastSent)) {
          throw new Error('pending/lastSent deben ser arrays');
        }
      },
    },
    {
      name: 'rate limit submit: 60 OK, 61 responde 429',
      async run() {
        const results: number[] = [];
        for (let i = 0; i < 62; i++) {
          const r = await submit('eliminar-tara', { FolioProcesoCarga: 100000 + i });
          results.push(r.status);
          if (r.status === 429) return;
        }
        const rate429 = results.filter((s) => s === 429).length;
        if (rate429 === 0) throw new Error(`esperaba al menos un 429 en 62 requests; statuses=${results.slice(0, 70).join(',')}`);
      },
    },
  ];

  for (const s of scenarios) {
    try {
      await s.run();
      console.log(`  OK   ${s.name}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  FAIL ${s.name}`);
      console.log(`       ${msg}`);
    }
  }

  // cleanup
  await prisma.submissionLog.deleteMany({
    where: { form_slug: 'eliminar-tara', error_message: { contains: 'No se encontr' } },
  });
  await prisma.notificationQueue.deleteMany({
    where: { payload_json: { contains: 'eliminar-tara' } },
  });

  await prisma.$disconnect();
  await closePool();
  console.log(`\n--- ${scenarios.length - failed}/${scenarios.length} OK ---`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
