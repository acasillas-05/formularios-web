import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { config } from '../config.js';

declare global {
  namespace Express {
    interface Request {
      /** Identificador unico del request. Util para correlacionar logs y respuestas de error. */
      id?: string;
    }
  }
}

/**
 * Asigna req.id y loguea al terminar el response con method/path/status/ms/user/id.
 * En dev: formato humano. En prod: JSON por linea, listo para ingerir.
 * No loguea healthchecks (/api/health) para reducir ruido.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const id = (req.header('x-request-id') ?? randomUUID()).slice(0, 36);
  req.id = id;
  res.setHeader('X-Request-Id', id);

  if (req.path === '/api/health') {
    next();
    return;
  }

  const started = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - started;
    const entry = {
      id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      user: req.user?.email ?? null,
    };
    if (config.isProduction) {
      console.log(JSON.stringify({ level: 'info', ...entry }));
    } else {
      const statusColor = res.statusCode >= 500 ? 31 : res.statusCode >= 400 ? 33 : 32;
      console.log(
        `[req] \x1b[${statusColor}m${res.statusCode}\x1b[0m ${entry.method} ${entry.path} ` +
          `${entry.duration_ms}ms user=${entry.user ?? '-'} id=${id.slice(0, 8)}`,
      );
    }
  });

  next();
}
