import {
  Building2,
  FileMinus,
  FileX,
  Gauge,
  Scale,
  ToggleLeft,
  Truck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

import type { FormSlug } from '../../lib/types';

/**
 * Mapeo de slug a icono Lucide. Permite identificar visualmente cada
 * formulario en listados sin depender del orden ni del titulo.
 */
export const FORM_ICONS: Record<FormSlug, LucideIcon> = {
  'registrar-unidad-adn': Truck,
  'registrar-unidad-cliente': Truck,
  'registrar-operador-adn': UserPlus,
  'registrar-operador-cliente': UserPlus,
  'placa-remolque': Truck,
  'eliminar-tara': Scale,
  'registrar-proveedor': Building2,
  'habilitar-concat-rem': ToggleLeft,
  'eliminar-entrada-lre': FileMinus,
  'eliminar-salida-tara-lrs': FileX,
  'permitir-pesaje-manual': Gauge,
};
