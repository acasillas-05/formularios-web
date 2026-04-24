import { type FormSlug, type Rol } from './roles.js';
import { type SpParamType } from '../services/spRunner.js';

/**
 * Catalogos disponibles para campos tipo searchable-select.
 * Mirror con el whitelist real en src/routes/catalogos.ts.
 */
export type CatalogoSlug =
  | 'proveedores-transportista'
  | 'proveedores-transportista-cliente'
  | 'tipos-proveedor'
  | 'centro-destino'
  | 'tipos-entrada'
  | 'centros-pesaje';

/**
 * Tipos de control para cada campo de formulario.
 * El renderer del frontend mapea cada kind a un componente UI.
 */
export type FieldType =
  | { kind: 'text'; maxLength?: number; placeholder?: string; uppercase?: boolean }
  | { kind: 'textarea'; maxLength?: number; placeholder?: string }
  | { kind: 'number'; min?: number; max?: number; integer?: boolean; allowNegative?: boolean }
  | { kind: 'radio'; options: readonly { value: string; label: string }[] }
  | { kind: 'select'; options: readonly { value: string; label: string }[] }
  | { kind: 'searchable-select'; source: CatalogoSlug };

export type FieldDefinition = {
  /** Clave del campo en el body JSON. Convencion: coincide con el nombre del parametro del SP cuando aplica. */
  name: string;
  label: string;
  description?: string;
  required: boolean;
  type: FieldType;
};

/**
 * Binding de parametro de SP: el valor viene del body validado o de una constante.
 * Las constantes (ej. TipoProveedor='Transportista') viven en la FormDefinition,
 * no se piden al usuario.
 */
export type SpParamBinding =
  | {
      spParamName: string;
      spParamType: SpParamType;
      source: 'field';
      fieldName: string;
    }
  | {
      spParamName: string;
      spParamType: SpParamType;
      source: 'constant';
      value: string | number | boolean | null;
    };

export type SpOutputSpec = {
  name: string;
  type: SpParamType;
};

/**
 * Parte PUBLICA de una FormDefinition: la que se envia al frontend al cargar el formulario.
 * Excluye detalles de ejecucion (SP, parametros) para no leakear implementacion.
 */
export type FormPublicDefinition = {
  slug: FormSlug;
  title: string;
  subtitle: string;
  fields: readonly FieldDefinition[];
  successMessage: string;
};

/**
 * FormDefinition COMPLETA: incluye ejecucion + rol minimo requerido.
 * Solo se usa en el backend.
 */
export type FormDefinition = FormPublicDefinition & {
  /** Rol minimo sin considerar permisos extra de jefe_de_patio. */
  baseRole: Rol;
  submit: {
    spName: string;
    spInputs: readonly SpParamBinding[];
    spOutputs?: readonly SpOutputSpec[];
    /**
     * true para SPs que no usan OUTPUT params y devuelven un resultset
     * con columnas Success, Estatus (sp_DeleteTara, sp_DeleteTaraSalidaLRS).
     */
    resultsetConvention?: boolean;
  };
};

export function toPublicDefinition(def: FormDefinition): FormPublicDefinition {
  return {
    slug: def.slug,
    title: def.title,
    subtitle: def.subtitle,
    fields: def.fields,
    successMessage: def.successMessage,
  };
}
