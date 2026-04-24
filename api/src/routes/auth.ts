import { Router, type Request, type Response } from 'express';

import { getFormsForUser } from '../forms/registry.js';

export const authRouter: Router = Router();

/**
 * Devuelve el usuario autenticado + lista de formularios que puede ver.
 * Es el endpoint que el frontend consume al cargar la app para saber que pintar.
 */
authRouter.get('/me', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: 'No autenticado' });
    return;
  }

  const forms = await getFormsForUser(req.user);

  res.json({
    ok: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      nombre: req.user.nombre,
      rol: req.user.rol,
    },
    forms,
  });
});
