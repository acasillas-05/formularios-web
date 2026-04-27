import type { Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';

import { ADMIN_ONLY_SLUGS, isFormSlug } from '../lib/roles.js';
import { getPool } from '../mssql.js';
import { prisma } from '../prisma.js';
import {
  createUserSchema,
  listSubmissionsQuerySchema,
  listUsersQuerySchema,
  setPermissionsSchema,
  statsQuerySchema,
  updateUserSchema,
} from '../schemas/admin.js';

export const adminRouter: Router = Router();

/* =========================================================
 * Usuarios
 * ========================================================= */

adminRouter.get('/users', async (req: Request, res: Response) => {
  const parsed = listUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Query invalido', issues: parsed.error.issues });
    return;
  }
  const q = parsed.data;

  const where: Prisma.UsuarioWhereInput = {
    deleted_at: null,
    ...(q.rol ? { rol: q.rol } : {}),
    ...(q.activo !== undefined ? { activo: q.activo } : {}),
    ...(q.search
      ? {
          OR: [
            { nombre: { contains: q.search } },
            { email: { contains: q.search } },
          ],
        }
      : {}),
  };

  const usuarios = await prisma.usuario.findMany({
    where,
    orderBy: [{ activo: 'desc' }, { rol: 'asc' }, { nombre: 'asc' }],
    select: {
      id: true,
      email: true,
      nombre: true,
      rol: true,
      activo: true,
      created_at: true,
      updated_at: true,
      _count: { select: { permisosExtra: true, submissions: true } },
    },
  });

  res.json({ ok: true, usuarios });
});

adminRouter.post('/users', async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Body invalido', issues: parsed.error.issues });
    return;
  }
  const body = parsed.data;

  const existing = await prisma.usuario.findUnique({ where: { email: body.email } });
  if (existing && !existing.deleted_at) {
    res.status(409).json({ ok: false, error: 'Ya existe un usuario con ese email' });
    return;
  }

  const usuario = existing
    ? await prisma.usuario.update({
        where: { id: existing.id },
        data: { nombre: body.nombre, rol: body.rol, activo: true, deleted_at: null },
      })
    : await prisma.usuario.create({
        data: { email: body.email, nombre: body.nombre, rol: body.rol },
      });

  res.status(201).json({ ok: true, usuario });
});

adminRouter.get('/users/:id', async (req: Request, res: Response) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: String(req.params.id) },
    include: {
      permisosExtra: { select: { form_slug: true, created_at: true, created_by: true } },
    },
  });
  if (!usuario || usuario.deleted_at) {
    res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    return;
  }
  res.json({ ok: true, usuario });
});

adminRouter.patch('/users/:id', async (req: Request, res: Response) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Body invalido', issues: parsed.error.issues });
    return;
  }
  const body = parsed.data;

  const target = await prisma.usuario.findUnique({ where: { id: String(req.params.id) } });
  if (!target || target.deleted_at) {
    res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    return;
  }

  // Guard: si degradas el rol de jefe_de_patio a otro, limpiamos sus permisos extra.
  const demotedFromJefe = body.rol !== undefined && target.rol === 'jefe_de_patio' && body.rol !== 'jefe_de_patio';

  const usuario = await prisma.$transaction(async (tx) => {
    if (demotedFromJefe) {
      await tx.usuarioFormPermiso.deleteMany({ where: { usuario_id: target.id } });
    }
    return tx.usuario.update({ where: { id: target.id }, data: body });
  });

  res.json({ ok: true, usuario });
});

adminRouter.delete('/users/:id', async (req: Request, res: Response) => {
  const target = await prisma.usuario.findUnique({ where: { id: String(req.params.id) } });
  if (!target || target.deleted_at) {
    res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    return;
  }

  // No dejarse borrar a si mismo: evita quedarse sin admin accidentalmente.
  if (req.user && req.user.id === target.id) {
    res.status(400).json({ ok: false, error: 'No puedes borrar tu propio usuario' });
    return;
  }

  await prisma.$transaction([
    prisma.usuarioFormPermiso.deleteMany({ where: { usuario_id: target.id } }),
    prisma.usuario.update({
      where: { id: target.id },
      data: { activo: false, deleted_at: new Date() },
    }),
  ]);

  res.json({ ok: true });
});

/* =========================================================
 * Permisos extra (solo jefe_de_patio)
 * ========================================================= */

adminRouter.get('/users/:id/permissions', async (req: Request, res: Response) => {
  const target = await prisma.usuario.findUnique({ where: { id: String(req.params.id) } });
  if (!target || target.deleted_at) {
    res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    return;
  }
  const rows = await prisma.usuarioFormPermiso.findMany({
    where: { usuario_id: target.id },
    select: { form_slug: true },
  });
  res.json({
    ok: true,
    formSlugs: rows.map((r) => r.form_slug).filter(isFormSlug),
    availableSlugs: ADMIN_ONLY_SLUGS,
  });
});

adminRouter.put('/users/:id/permissions', async (req: Request, res: Response) => {
  const parsed = setPermissionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Body invalido', issues: parsed.error.issues });
    return;
  }

  const target = await prisma.usuario.findUnique({ where: { id: String(req.params.id) } });
  if (!target || target.deleted_at) {
    res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    return;
  }
  if (target.rol !== 'jefe_de_patio') {
    res.status(400).json({
      ok: false,
      error: 'Los permisos extra solo aplican al rol jefe_de_patio',
    });
    return;
  }

  const allowed = new Set<string>(ADMIN_ONLY_SLUGS);
  const invalid = parsed.data.formSlugs.filter((s) => !allowed.has(s));
  if (invalid.length > 0) {
    res.status(400).json({
      ok: false,
      error: `Slugs no validos para permisos extra: ${invalid.join(', ')}`,
    });
    return;
  }

  const createdBy = req.user?.email ?? 'unknown';

  await prisma.$transaction([
    prisma.usuarioFormPermiso.deleteMany({ where: { usuario_id: target.id } }),
    prisma.usuarioFormPermiso.createMany({
      data: parsed.data.formSlugs.map((slug) => ({
        usuario_id: target.id,
        form_slug: slug,
        created_by: createdBy,
      })),
    }),
  ]);

  res.json({ ok: true, formSlugs: parsed.data.formSlugs });
});

/* =========================================================
 * Auditoria de submissions
 * ========================================================= */

adminRouter.get('/submissions', async (req: Request, res: Response) => {
  const parsed = listSubmissionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Query invalido', issues: parsed.error.issues });
    return;
  }
  const q = parsed.data;

  const where: Prisma.SubmissionLogWhereInput = {};
  if (q.formSlug) where.form_slug = q.formSlug;
  if (q.usuarioId) where.usuario_id = q.usuarioId;
  if (q.result) where.result = q.result;
  if (q.desde || q.hasta) {
    where.created_at = {};
    if (q.desde) where.created_at.gte = new Date(`${q.desde}T00:00:00.000Z`);
    if (q.hasta) where.created_at.lt = new Date(`${q.hasta}T23:59:59.999Z`);
  }

  const [total, submissions] = await Promise.all([
    prisma.submissionLog.count({ where }),
    prisma.submissionLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: q.offset,
      take: q.limit,
      select: {
        id: true,
        usuario_email: true,
        form_slug: true,
        sp_name: true,
        result: true,
        error_message: true,
        duration_ms: true,
        created_at: true,
      },
    }),
  ]);

  res.json({ ok: true, total, limit: q.limit, offset: q.offset, submissions });
});

adminRouter.get('/submissions/:id', async (req: Request, res: Response) => {
  const submission = await prisma.submissionLog.findUnique({ where: { id: String(req.params.id) } });
  if (!submission) {
    res.status(404).json({ ok: false, error: 'Submission no encontrado' });
    return;
  }
  res.json({ ok: true, submission });
});

/* =========================================================
 * Notificaciones pendientes
 * ========================================================= */

adminRouter.get('/notifications', async (_req: Request, res: Response) => {
  const [pending, lastSent, totals] = await Promise.all([
    prisma.notificationQueue.findMany({
      where: { sent_at: null },
      orderBy: { created_at: 'asc' },
      take: 100,
    }),
    prisma.notificationQueue.findMany({
      where: { sent_at: { not: null } },
      orderBy: { sent_at: 'desc' },
      take: 50,
    }),
    prisma.notificationQueue.groupBy({
      by: ['kind'],
      _count: { _all: true },
      where: { sent_at: null },
    }),
  ]);
  res.json({ ok: true, pending, lastSent, totals });
});

/**
 * Reencola una notificacion ya enviada (o que se quedo trabada): pone
 * sent_at en NULL para que el worker la procese de nuevo en el siguiente tick.
 */
adminRouter.post('/notifications/:id/resend', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.notificationQueue.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ ok: false, error: 'Notificacion no encontrada' });
    return;
  }
  const updated = await prisma.notificationQueue.update({
    where: { id },
    data: { sent_at: null },
  });
  res.json({ ok: true, notification: updated });
});

/* =========================================================
 * Diagnostics (health profundo, ping a BD plataforma + BDADN)
 * ========================================================= */

type CheckStatus = { ok: boolean; latency_ms?: number; error?: string };

async function timed(fn: () => Promise<unknown>): Promise<CheckStatus> {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - start, error: err instanceof Error ? err.message : 'error' };
  }
}

adminRouter.get('/diagnostics', async (_req: Request, res: Response) => {
  const [platformDb, bdadn] = await Promise.all([
    timed(() => prisma.$queryRaw`SELECT 1`),
    timed(async () => {
      const pool = await getPool();
      await pool.request().query('SELECT 1 AS ok');
    }),
  ]);
  const ok = platformDb.ok && bdadn.ok;
  res.status(ok ? 200 : 503).json({
    ok,
    platformDb,
    bdadn,
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
 * Stats / dashboard
 * ========================================================= */

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx] ?? 0;
}

adminRouter.get('/stats', async (req: Request, res: Response) => {
  const parsed = statsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Query invalido', issues: parsed.error.issues });
    return;
  }
  const { days } = parsed.data;

  const now = new Date();
  const todayStart = startOfDayUtc(now);
  const windowStart = new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    today,
    last24hOk,
    last24hErr,
    windowOk,
    windowErr,
    byForm,
    byUser,
    durations,
    rangeRows,
    activeUsers,
    pendingNotifs,
  ] = await Promise.all([
    prisma.submissionLog.count({ where: { created_at: { gte: todayStart } } }),
    prisma.submissionLog.count({ where: { created_at: { gte: last24h }, result: 'ok' } }),
    prisma.submissionLog.count({ where: { created_at: { gte: last24h }, result: 'error' } }),
    prisma.submissionLog.count({ where: { created_at: { gte: windowStart }, result: 'ok' } }),
    prisma.submissionLog.count({ where: { created_at: { gte: windowStart }, result: 'error' } }),
    prisma.submissionLog.groupBy({
      by: ['form_slug', 'result'],
      _count: { _all: true },
      where: { created_at: { gte: windowStart } },
    }),
    prisma.submissionLog.groupBy({
      by: ['usuario_email'],
      _count: { _all: true },
      where: { created_at: { gte: windowStart } },
      orderBy: { _count: { usuario_email: 'desc' } },
      take: 5,
    }),
    prisma.submissionLog.findMany({
      select: { duration_ms: true },
      where: { created_at: { gte: windowStart } },
    }),
    prisma.submissionLog.findMany({
      select: { created_at: true, result: true },
      where: { created_at: { gte: windowStart } },
      orderBy: { created_at: 'asc' },
    }),
    prisma.usuario.count({ where: { activo: true, deleted_at: null } }),
    prisma.notificationQueue.count({ where: { sent_at: null } }),
  ]);

  // Latencia: percentiles sobre duraciones de los OK del window
  const sortedDurations = durations.map((d) => d.duration_ms).sort((a, b) => a - b);
  const p50 = percentile(sortedDurations, 50);
  const p95 = percentile(sortedDurations, 95);
  const p99 = percentile(sortedDurations, 99);

  // Serie por dia para el grafico (rellena dias sin datos con 0)
  const dayBuckets = new Map<string, { ok: number; error: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(windowStart.getTime() + i * 24 * 60 * 60 * 1000);
    dayBuckets.set(isoDate(d), { ok: 0, error: 0 });
  }
  for (const row of rangeRows) {
    const key = isoDate(row.created_at);
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;
    if (row.result === 'ok') bucket.ok++;
    else bucket.error++;
  }
  const series = Array.from(dayBuckets.entries()).map(([date, v]) => ({
    date,
    ok: v.ok,
    error: v.error,
  }));

  // Reorganizar byForm en mapa slug -> { ok, error }
  const byFormMap = new Map<string, { ok: number; error: number }>();
  for (const row of byForm) {
    const slug = row.form_slug;
    const entry = byFormMap.get(slug) ?? { ok: 0, error: 0 };
    if (row.result === 'ok') entry.ok = row._count._all;
    else if (row.result === 'error') entry.error = row._count._all;
    byFormMap.set(slug, entry);
  }
  const byFormArr = Array.from(byFormMap.entries())
    .map(([slug, v]) => ({ slug, ok: v.ok, error: v.error, total: v.ok + v.error }))
    .sort((a, b) => b.total - a.total);

  res.json({
    ok: true,
    window: { days, from: windowStart.toISOString(), to: now.toISOString() },
    kpis: {
      today,
      last24hOk,
      last24hErr,
      windowOk,
      windowErr,
      windowTotal: windowOk + windowErr,
      errorRate: windowOk + windowErr === 0 ? 0 : windowErr / (windowOk + windowErr),
      activeUsers,
      pendingNotifs,
    },
    latency: { p50, p95, p99 },
    series,
    byForm: byFormArr,
    topUsers: byUser.map((u) => ({ email: u.usuario_email, count: u._count._all })),
  });
});
