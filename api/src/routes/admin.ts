import type { Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';

import { ADMIN_ONLY_SLUGS, isFormSlug } from '../lib/roles.js';
import { prisma } from '../prisma.js';
import {
  createUserSchema,
  listSubmissionsQuerySchema,
  listUsersQuerySchema,
  setPermissionsSchema,
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
