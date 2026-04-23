import { type FormSlug } from '../lib/roles.js';

/**
 * Metadata minima de cada formulario. Suficiente para mostrar la lista al usuario
 * tras el login. Las FormDefinition completas (campos, SP, validaciones) se
 * agregan en Fase 4 en archivos separados bajo src/forms/definitions/.
 */
export type FormSummary = {
  slug: FormSlug;
  title: string;
  subtitle: string;
};

const ENTRIES: Record<FormSlug, Omit<FormSummary, 'slug'>> = {
  'registrar-unidad-adn': {
    title: 'Registrar Unidades (Transportista ADN)',
    subtitle: 'Registrar unidades de transporte propio.',
  },
  'registrar-unidad-cliente': {
    title: 'Registrar Unidades (Transportista Cliente)',
    subtitle: 'Registrar unidades de transporte del cliente.',
  },
  'registrar-operador-adn': {
    title: 'Registrar Operadores (Transportista ADN)',
    subtitle: 'Registrar operadores de transporte propio.',
  },
  'registrar-operador-cliente': {
    title: 'Registrar Operadores (Transportista Cliente)',
    subtitle: 'Registrar operadores de transporte del cliente.',
  },
  'placa-remolque': {
    title: 'Placa Remolque',
    subtitle: 'Registrar placas de remolque (solo ADN Transporte).',
  },
  'eliminar-tara': {
    title: 'Eliminar Tara',
    subtitle: 'Eliminar un registro de la tabla Tara por FolioProcesoCarga.',
  },
  'registrar-proveedor': {
    title: 'Registrar Proveedor',
    subtitle: 'Registrar lineas transportistas y proveedores de materia prima.',
  },
  'habilitar-concat-rem': {
    title: 'Habilitar Concatenado Remision Externa',
    subtitle: 'Habilitar o deshabilitar el envio de remision externa concatenada.',
  },
  'eliminar-entrada-lre': {
    title: 'Eliminar Entrada LRE',
    subtitle: 'Eliminar Entradas y LotesRealesEntrada.',
  },
  'eliminar-salida-tara-lrs': {
    title: 'Eliminar Salida - Tara - LotesRealesSalida',
    subtitle: 'Eliminar una salida dada una Entrega (borra LRS, Salida y Tara asociada).',
  },
  'permitir-pesaje-manual': {
    title: 'Permitir Pesaje Manual',
    subtitle: 'Activar o desactivar pesaje manual por centro.',
  },
};

export function getFormSummary(slug: FormSlug): FormSummary {
  return { slug, ...ENTRIES[slug] };
}

export function getFormSummaries(slugs: readonly FormSlug[]): FormSummary[] {
  return slugs.map(getFormSummary);
}
