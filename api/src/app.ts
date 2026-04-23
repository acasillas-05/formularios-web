import compression from 'compression';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { config } from './config.js';

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

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'formularios-web-api',
      env: config.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: 'Not Found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const status = err instanceof Error && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500;

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
