import { z } from 'zod';

import { type FieldDefinition, type FieldType, type FormDefinition } from '../lib/formTypes.js';
import { type SpExecution } from '../services/spRunner.js';

/**
 * Genera un zod schema para validar el body JSON de un submit
 * a partir de la lista de fields de una FormDefinition.
 */
export function zodFromFields(fields: readonly FieldDefinition[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape = Object.fromEntries(fields.map((f) => [f.name, fieldToZod(f)]));
  return z.object(shape).strict();
}

function fieldToZod(field: FieldDefinition): z.ZodTypeAny {
  const base = baseSchemaForType(field.type);
  if (field.required) return base;
  // opcional: acepta undefined o null; null se normaliza a undefined para el mapper
  return z.preprocess((v) => (v === null ? undefined : v), base.optional());
}

function baseSchemaForType(type: FieldType): z.ZodTypeAny {
  switch (type.kind) {
    case 'text':
    case 'textarea': {
      let s = z.string().trim().min(1);
      if (type.maxLength !== undefined) s = s.max(type.maxLength);
      return type.kind === 'text' && type.uppercase ? s.transform((v) => v.toUpperCase()) : s;
    }
    case 'number': {
      // Coerce strings a numbers: los <input type="number"> del HTML envian string.
      // z.coerce.number() en zod 4 devuelve ZodCoercedNumber (no ZodNumber).
      let s = type.integer ? z.coerce.number().int() : z.coerce.number();
      if (type.min !== undefined) s = s.min(type.min);
      if (type.max !== undefined) s = s.max(type.max);
      if (!type.allowNegative && type.min === undefined) s = s.min(0);
      return s;
    }
    case 'radio':
    case 'select': {
      const values = type.options.map((o) => o.value);
      if (values.length === 0) return z.string();
      return z.enum(values as [string, ...string[]]);
    }
    case 'searchable-select':
      return z.string().trim().min(1);
  }
}

/**
 * Mapea la FormDefinition y el body ya validado a un SpExecution
 * concreto para pasarselo al spRunner.
 * Detecta errores de programacion como "el field que pide el binding no esta en fields".
 */
export function buildSpExecution(def: FormDefinition, body: Record<string, unknown>): SpExecution {
  const inputs = def.submit.spInputs.map((binding) => {
    if (binding.source === 'constant') {
      return {
        name: binding.spParamName,
        type: binding.spParamType,
        value: binding.value,
      };
    }
    // source === 'field'
    const raw = body[binding.fieldName];
    return {
      name: binding.spParamName,
      type: binding.spParamType,
      value: raw === undefined ? null : raw,
    };
  });

  return {
    spName: def.submit.spName,
    inputs,
    outputs: def.submit.spOutputs?.map((o) => ({ name: o.name, type: o.type })),
  };
}
