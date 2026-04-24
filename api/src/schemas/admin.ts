import { z } from 'zod';

import { FORM_SLUGS, ROLES } from '../lib/roles.js';

/**
 * Schemas zod para los endpoints de /api/admin.
 * Se exponen via router y tambien sirven como fuente de tipado
 * (z.infer<typeof createUserSchema>).
 */

export const createUserSchema = z.object({
  email: z.string().trim().min(1).max(256).email().transform((s) => s.toLowerCase()),
  nombre: z.string().trim().min(1).max(120),
  rol: z.enum(ROLES),
});

export const updateUserSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).optional(),
    rol: z.enum(ROLES).optional(),
    activo: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Debes enviar al menos un campo a actualizar',
  });

export const setPermissionsSchema = z.object({
  formSlugs: z.array(z.enum(FORM_SLUGS)),
});

export const listUsersQuerySchema = z.object({
  rol: z.enum(ROLES).optional(),
  activo: z
    .union([z.literal('true'), z.literal('false')])
    .transform((s) => s === 'true')
    .optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export const listSubmissionsQuerySchema = z.object({
  formSlug: z.enum(FORM_SLUGS).optional(),
  usuarioId: z.string().uuid().optional(),
  result: z.enum(['ok', 'error']).optional(),
  /** Fechas ISO YYYY-MM-DD (inclusive para inicio, exclusive para fin). */
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
export type SetPermissionsBody = z.infer<typeof setPermissionsSchema>;
