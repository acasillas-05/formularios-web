import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { executeAndAudit } from '../services/auditService.js';

export const formsRouter: Router = Router();

/**
 * Endpoint temporal de Fase 3. En Fase 4 se reemplaza por un handler
 * generico /api/forms/:slug/submit que lee la FormDefinition del registry.
 *
 * POST /api/forms/registrar-unidad-adn/submit
 * Body: { NombreProveedor, NumEconomicoInput, PlacaInput }
 * Llama sp_InsertarPlaca con TipoProveedor='Transportista'.
 */
const registrarUnidadAdnBody = z.object({
  NombreProveedor: z.string().trim().min(1).max(100),
  NumEconomicoInput: z.string().trim().min(1).max(50),
  PlacaInput: z.string().trim().min(1).max(50),
});

formsRouter.post('/registrar-unidad-adn/submit', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: 'No autenticado' });
    return;
  }

  const parsed = registrarUnidadAdnBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: 'Body invalido',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  const body = parsed.data;
  const audited = await executeAndAudit({
    user: req.user,
    formSlug: 'registrar-unidad-adn',
    payload: body,
    execution: {
      spName: 'sp_InsertarPlaca',
      inputs: [
        { name: 'NombreProveedor', type: { kind: 'NVARCHAR', length: 100 }, value: body.NombreProveedor },
        { name: 'NumEconomicoInput', type: { kind: 'NVARCHAR', length: 50 }, value: body.NumEconomicoInput },
        { name: 'PlacaInput', type: { kind: 'NVARCHAR', length: 50 }, value: body.PlacaInput },
        { name: 'TipoProveedor', type: { kind: 'NVARCHAR', length: 50 }, value: 'Transportista' },
      ],
      outputs: [
        { name: 'Status', type: { kind: 'INT' } },
        { name: 'Error', type: { kind: 'NVARCHAR', length: 'MAX' } },
      ],
    },
  });

  if (!audited.ok) {
    res.status(400).json({
      ok: false,
      status: audited.status,
      error: audited.message ?? 'Error al registrar la unidad',
      submissionId: audited.submissionId,
    });
    return;
  }

  res.json({
    ok: true,
    status: audited.status,
    submissionId: audited.submissionId,
    durationMs: audited.spResult.durationMs,
  });
});
