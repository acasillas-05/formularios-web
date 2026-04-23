/**
 * Fuente de verdad para roles y permisos de formularios.
 * Las reglas de resolucion viven en src/middleware/rbac.ts.
 */

export const ROLES = ['administrador', 'jefe_de_patio', 'operativo'] as const;
export type Rol = (typeof ROLES)[number];

export function isRol(value: unknown): value is Rol {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Los 11 formularios que reemplazan a Microsoft Forms. */
export const FORM_SLUGS = [
  'registrar-unidad-adn',
  'registrar-unidad-cliente',
  'registrar-operador-adn',
  'registrar-operador-cliente',
  'placa-remolque',
  'eliminar-tara',
  'registrar-proveedor',
  'habilitar-concat-rem',
  'eliminar-entrada-lre',
  'eliminar-salida-tara-lrs',
  'permitir-pesaje-manual',
] as const;

export type FormSlug = (typeof FORM_SLUGS)[number];

export function isFormSlug(value: unknown): value is FormSlug {
  return typeof value === 'string' && (FORM_SLUGS as readonly string[]).includes(value);
}

/**
 * 5 formularios base: los ve cualquier rol operativo (y por herencia jefe_de_patio y admin).
 * Derivan del requerimiento del usuario: migracion de Registrar Unidades/Operadores + Placa Remolque.
 */
export const OPERATIVO_SLUGS = [
  'registrar-unidad-adn',
  'registrar-unidad-cliente',
  'registrar-operador-adn',
  'registrar-operador-cliente',
  'placa-remolque',
] as const satisfies readonly FormSlug[];

/**
 * 6 formularios restringidos: los ve admin siempre y jefe_de_patio solo si el admin
 * le habilita uno por uno a traves de la tabla UsuarioFormPermiso.
 */
export const ADMIN_ONLY_SLUGS = [
  'eliminar-tara',
  'registrar-proveedor',
  'habilitar-concat-rem',
  'eliminar-entrada-lre',
  'eliminar-salida-tara-lrs',
  'permitir-pesaje-manual',
] as const satisfies readonly FormSlug[];
