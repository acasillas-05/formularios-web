import type { Usuario } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /**
       * Usuario autenticado. Lo setea authMiddleware.
       * Disponible en cualquier handler registrado despues de app.use(authMiddleware).
       */
      user?: Usuario;
    }
  }
}

export {};
