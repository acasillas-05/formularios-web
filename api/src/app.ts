import compression from 'compression';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { formsRouter } from './routes/forms.js';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(compression());
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

  app.use('/api/auth', authRouter);
  app.use('/api/forms', formsRouter);

  // 404 final — cualquier /api/* sin match cae aqui y devuelve JSON.
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: 'Not Found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      err instanceof Error && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    const message = err instanceof Error ? err.message : 'Internal Server Error';

    if (!config.isProduction) {
      console.error('[error]', err);
    }

    res.status(status).json({
      ok: false,
      error: config.isProduction && status >= 500 ? 'Internal Server Error' : message,
    });
  });

  return app;
}
