/**
 * Tipos compartidos del frontend. Espejo de los tipos publicos expuestos
 * por el API en /api/auth/me, /api/forms, /api/forms/:slug, /api/catalogos/:tipo.
 *
 * Deben mantenerse en sync manual con api/src/lib/formTypes.ts y
 * api/src/lib/roles.ts hasta que movamos a un paquete compartido.
 */

export type Rol = 'administrador' | 'jefe_de_patio' | 'operativo';

export type FormSlug =
  | 'registrar-unidad-adn'
  | 'registrar-unidad-cliente'
  | 'registrar-operador-adn'
  | 'registrar-operador-cliente'
  | 'placa-remolque'
  | 'eliminar-tara'
  | 'registrar-proveedor'
  | 'habilitar-concat-rem'
  | 'eliminar-entrada-lre'
  | 'eliminar-salida-tara-lrs'
  | 'permitir-pesaje-manual';

export type CatalogoSlug =
  | 'proveedores-transportista'
  | 'proveedores-transportista-cliente'
  | 'tipos-proveedor'
  | 'centro-destino'
  | 'tipos-entrada'
  | 'centros-pesaje';

export type FieldType =
  | { kind: 'text'; maxLength?: number; placeholder?: string; uppercase?: boolean }
  | { kind: 'textarea'; maxLength?: number; placeholder?: string }
  | { kind: 'number'; min?: number; max?: number; integer?: boolean; allowNegative?: boolean }
  | { kind: 'radio'; options: readonly { value: string; label: string }[] }
  | { kind: 'select'; options: readonly { value: string; label: string }[] }
  | { kind: 'searchable-select'; source: CatalogoSlug };

export type FieldDefinition = {
  name: string;
  label: string;
  description?: string;
  required: boolean;
  type: FieldType;
};

export type FormListItem = {
  slug: FormSlug;
  title: string;
  subtitle: string;
};

export type FormPublicDefinition = {
  slug: FormSlug;
  title: string;
  subtitle: string;
  fields: readonly FieldDefinition[];
  successMessage: string;
};

export type AuthMeUser = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
};

export type AuthMeResponse = {
  ok: true;
  user: AuthMeUser;
  forms: FormListItem[];
};

export type CatalogoOption = { value: string; label: string };

export type CatalogoResponse = {
  ok: true;
  catalogo: CatalogoSlug;
  options: CatalogoOption[];
};
