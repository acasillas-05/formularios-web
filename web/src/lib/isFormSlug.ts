import type { FormSlug } from './types';

const KNOWN: readonly string[] = [
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
];

export function isFormSlugLike(value: string): value is FormSlug {
  return KNOWN.includes(value);
}
