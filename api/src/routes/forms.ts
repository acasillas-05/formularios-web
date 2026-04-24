import { Router, type Request, type Response } from 'express';

import { buildSpExecution, zodFromFields } from '../forms/engine.js';
import { getFormDefinition, getFormsForUser, getPublicDefinition } from '../forms/registry.js';
import { isFormSlug } from '../lib/roles.js';
import { canAccessSlug } from '../middleware/rbac.js';
import { executeAndAudit } from '../services/auditService.js';

export const formsRouter: Router = Router();

/**
 * GET /api/forms - lista resumida de forms que el usuario puede ver.
 * Misma data que /api/auth/me.forms, util cuando la UI la quiere refrescar.
 */
formsRouter.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: 'No autenticado' });
    return;
  }
  const forms = await getFormsForUser(req.user);
  res.json({ ok: true, forms });
});

/**
 * GET /api/forms/:slug - FormPublicDefinition completa (fields para el renderer).
 * Valida permiso. 404 si slug no existe en el registry.
 */
formsRouter.get('/:slug', async (req: Request, res: Response) => {
  const slug = req.params.slug;
  if (!isFormSlug(slug)) {
    res.status(404).json({ ok: false, error: 'Formulario desconocido' });
    return;
  }
  if (!req.user) {
    res.status(401).json({ ok: false, error: 'No autenticado' });
    return;
  }
  const allowed = await canAccessSlug(req.user, slug);
  if (!allowed) {
    res.status(403).json({ ok: false, error: 'No tienes permiso para este formulario' });
    return;
  }
  const def = getPublicDefinition(slug);
  if (!def) {
    res.status(404).json({ ok: false, error: 'Formulario sin definicion (pendiente de implementacion)' });
    return;
  }
  res.json({ ok: true, form: def });
});

/**
 * POST /api/forms/:slug/submit - ejecuta el SP declarado en FormDefinition.
 * Pipeline: auth -> rbac -> zod -> buildSpExecution -> executeAndAudit.
 */
formsRouter.post('/:slug/submit', async (req: Request, res: Response) => {
  const slug = req.params.slug;
  if (!isFormSlug(slug)) {
    res.status(404).json({ ok: false, error: 'Formulario desconocido' });
    return;
  }
  if (!req.user) {
    res.status(401).json({ ok: false, error: 'No autenticado' });
    return;
  }

  const allowed = await canAccessSlug(req.user, slug);
  if (!allowed) {
    res.status(403).json({ ok: false, error: 'No tienes permiso para este formulario' });
    return;
  }

  const def = getFormDefinition(slug);
  if (!def) {
    res.status(404).json({ ok: false, error: 'Formulario sin definicion (pendiente de implementacion)' });
    return;
  }

  const schema = zodFromFields(def.fields);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: 'Body invalido',
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  const body = parsed.data as Record<string, unknown>;

  const audited = await executeAndAudit({
    user: req.user,
    formSlug: slug,
    payload: body,
    execution: buildSpExecution(def, body),
    resultsetConvention: def.submit.resultsetConvention,
  });

  if (!audited.ok) {
    res.status(400).json({
      ok: false,
      status: audited.status,
      error: audited.message ?? 'Error al procesar el formulario',
      submissionId: audited.submissionId,
    });
    return;
  }

  res.json({
    ok: true,
    status: audited.status,
    submissionId: audited.submissionId,
    successMessage: def.successMessage,
    // Exponer recordsets + output para que el frontend pueda mostrar info especifica
    // (ej. IDProveedorAsignado devuelto por sp_InsertarProveedor).
    output: audited.spResult.output,
    recordset: audited.spResult.recordset,
    durationMs: audited.spResult.durationMs,
  });
});
