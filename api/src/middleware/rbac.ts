import type { Usuario } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';

import {
  ADMIN_ONLY_SLUGS,
  FORM_SLUGS,
  OPERATIVO_SLUGS,
  type FormSlug,
  isFormSlug,
  isRol,
  type Rol,
} from '../lib/roles.js';
import { prisma } from '../prisma.js';

function rol(user: Usuario): Rol {
  return isRol(user.rol) ? user.rol : 'operativo';
}

/** Verifica si el usuario puede acceder al formulario `slug`. */
export async function canAccessSlug(user: Usuario, slug: FormSlug): Promise<boolean> {
  switch (rol(user)) {
    case 'administrador':
      return true;
    case 'operativo':
      return (OPERATIVO_SLUGS as readonly FormSlug[]).includes(slug);
    case 'jefe_de_patio': {
      if ((OPERATIVO_SLUGS as readonly FormSlug[]).includes(slug)) return true;
      if (!(ADMIN_ONLY_SLUGS as readonly FormSlug[]).includes(slug)) return false;
      const permiso = await prisma.usuarioFormPermiso.findUnique({
        where: { usuario_id_form_slug: { usuario_id: user.id, form_slug: slug } },
      });
      return permiso !== null;
    }
  }
}

/** Devuelve la lista completa de slugs que el usuario puede ver. */
export async function getSlugsForUser(user: Usuario): Promise<FormSlug[]> {
  switch (rol(user)) {
    case 'administrador':
      return [...FORM_SLUGS];
    case 'operativo':
      return [...OPERATIVO_SLUGS];
    case 'jefe_de_patio': {
      const extras = await prisma.usuarioFormPermiso.findMany({
        where: { usuario_id: user.id },
        select: { form_slug: true },
      });
      const extraSlugs = extras
        .map((e) => e.form_slug)
        .filter(isFormSlug);
      return [...OPERATIVO_SLUGS, ...extraSlugs];
    }
  }
}

/**
 * Middleware factory para proteger rutas individuales.
 * Uso: router.post('/:slug/submit', requireSlugAccess, handler).
 * Toma el slug de req.params.slug.
 */
export function requireSlugAccess(req: Request, res: Response, next: NextFunction): void {
  const rawSlug = req.params.slug;
  if (!isFormSlug(rawSlug)) {
    res.status(404).json({ ok: false, error: 'Formulario desconocido' });
    return;
  }
  if (!req.user) {
    res.status(401).json({ ok: false, error: 'No autenticado' });
    return;
  }
  canAccessSlug(req.user, rawSlug)
    .then((allowed) => {
      if (!allowed) {
        res.status(403).json({ ok: false, error: 'No tienes permiso para este formulario' });
        return;
      }
      next();
    })
    .catch(next);
}

/** Middleware que requiere rol `administrador`. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ ok: false, error: 'No autenticado' });
    return;
  }
  if (rol(req.user) !== 'administrador') {
    res.status(403).json({ ok: false, error: 'Requiere rol administrador' });
    return;
  }
  next();
}
