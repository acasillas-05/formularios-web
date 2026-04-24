import compression from 'compression';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';
import { requestLogger } from './middleware/logging.js';
import { requireAdmin } from './middleware/rbac.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { catalogosRouter } from './routes/catalogos.js';
import { formsRouter } from './routes/forms.js';

/**
 * Rate limit estricto para POST /api/forms/:slug/submit.
 * Clave por usuario autenticado; fallback a IP si el request llega sin auth
 * (no deberia suceder tras authMiddleware, pero es defensa en profundidad).
 */
const submitLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
  message: { ok: false, error: 'Demasiadas peticiones. Espera un momento.' },
});

function isSubmitRoute(req: Request): boolean {
  return req.method === 'POST' && req.path.endsWith('/submit');
}

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(compression());
  app.use(requestLogger);

  app.use(
    '/api',
    rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 700,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '256kb' }));

  // /api/health es publico — smoke test sin auth.
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'formularios-web-api',
      env: config.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  });

  // Todas las demas rutas /api/* requieren autenticacion (Entra ID o DEV_BYPASS).
  app.use('/api', authMiddleware);

  // Rate limit mas estricto especifico de submit (60 por minuto por usuario).
  app.use('/api/forms', (req, res, next) => {
    if (isSubmitRoute(req)) {
      submitLimiter(req, res, next);
      return;
    }
    next();
  });

  app.use('/api/auth', authRouter);
  app.use('/api/forms', formsRouter);
  app.use('/api/catalogos', catalogosRouter);
  app.use('/api/admin', requireAdmin, adminRouter);

  // 404 final — cualquier /api/* sin match cae aqui y devuelve JSON.
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: 'Not Found' });
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const status =
      err instanceof Error && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const requestId = req.id;

    // Log completo del lado del servidor (incluye stack cuando aplique).
    console.error(
      `[error] id=${requestId?.slice(0, 8)} status=${status} ${req.method} ${req.path} user=${req.user?.email ?? '-'}`,
      err instanceof Error ? err.stack ?? err.message : err,
    );

    // El body de respuesta NUNCA expone stack. En prod, errores 5xx se enmascaran.
    const exposeMessage = !config.isProduction || status < 500;
    res.status(status).json({
      ok: false,
      error: exposeMessage ? message : 'Internal Server Error',
      requestId,
    });
  });

  return app;
}
