import type { FieldDefinition } from '../../lib/types';

/**
 * Validacion ligera client-side para feedback inmediato.
 * La validacion autoritativa vive en el backend (zod via engine.ts + el SP).
 * Aqui solo necesitamos UX rapida, no seguridad.
 */

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' ||
    (typeof value === 'number' && Number.isNaN(value));
}

export function validateField(field: FieldDefinition, value: unknown): string | null {
  if (isEmpty(value)) {
    return field.required ? 'Campo requerido.' : null;
  }

  switch (field.type.kind) {
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string') return 'Valor invalido.';
      if (field.type.maxLength !== undefined && value.length > field.type.maxLength) {
        return `Maximo ${field.type.maxLength} caracteres.`;
      }
      return null;
    }
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(n)) return 'Debe ser un numero.';
      if (field.type.integer && !Number.isInteger(n)) return 'Debe ser un entero.';
      if (field.type.min !== undefined && n < field.type.min) return `Minimo ${field.type.min}.`;
      if (field.type.max !== undefined && n > field.type.max) return `Maximo ${field.type.max}.`;
      if (!field.type.allowNegative && field.type.min === undefined && n < 0) {
        return 'No se aceptan valores negativos.';
      }
      return null;
    }
    case 'radio':
    case 'select': {
      const validValues = field.type.options.map((o) => o.value);
      if (typeof value !== 'string' || !validValues.includes(value)) return 'Opcion invalida.';
      return null;
    }
    case 'searchable-select': {
      if (typeof value !== 'string' || value.length === 0) return 'Opcion invalida.';
      return null;
    }
  }
}

export function validateForm(
  fields: readonly FieldDefinition[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const err = validateField(f, values[f.name]);
    if (err) errors[f.name] = err;
  }
  return errors;
}

/**
 * Normaliza el body antes de enviar al backend:
 * - number: convierte string a number (o deja undefined si vacio y opcional)
 * - text/textarea: trim
 * - vacios opcionales: null (el backend los trata como NULL en el SP)
 */
export function normalizeValues(
  fields: readonly FieldDefinition[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = values[f.name];
    if (isEmpty(raw)) {
      if (!f.required) out[f.name] = null;
      continue;
    }
    switch (f.type.kind) {
      case 'text':
      case 'textarea':
        out[f.name] = typeof raw === 'string' ? raw.trim() : raw;
        break;
      case 'number':
        out[f.name] = typeof raw === 'number' ? raw : Number(raw);
        break;
      default:
        out[f.name] = raw;
    }
  }
  return out;
}
