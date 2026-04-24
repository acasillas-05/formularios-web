import type { Usuario } from '@prisma/client';

import { type FormDefinition, type FormPublicDefinition, toPublicDefinition } from '../lib/formTypes.js';
import { type FormSlug } from '../lib/roles.js';
import { getSlugsForUser } from '../middleware/rbac.js';

import { eliminarEntradaLre } from './definitions/eliminarEntradaLre.js';
import { eliminarSalidaTaraLrs } from './definitions/eliminarSalidaTaraLrs.js';
import { eliminarTara } from './definitions/eliminarTara.js';
import { habilitarConcatRem } from './definitions/habilitarConcatRem.js';
import { permitirPesajeManual } from './definitions/permitirPesajeManual.js';
import { placaRemolque } from './definitions/placaRemolque.js';
import { registrarOperadorAdn } from './definitions/registrarOperadorAdn.js';
import { registrarOperadorCliente } from './definitions/registrarOperadorCliente.js';
import { registrarProveedor } from './definitions/registrarProveedor.js';
import { registrarUnidadAdn } from './definitions/registrarUnidadAdn.js';
import { registrarUnidadCliente } from './definitions/registrarUnidadCliente.js';

/**
 * Fuente de verdad de las FormDefinition implementadas.
 * Los 11 formularios que reemplazan a Microsoft Forms.
 */
const REGISTRY: Partial<Record<FormSlug, FormDefinition>> = {
  'registrar-unidad-adn': registrarUnidadAdn,
  'registrar-unidad-cliente': registrarUnidadCliente,
  'registrar-operador-adn': registrarOperadorAdn,
  'registrar-operador-cliente': registrarOperadorCliente,
  'placa-remolque': placaRemolque,
  'eliminar-tara': eliminarTara,
  'registrar-proveedor': registrarProveedor,
  'habilitar-concat-rem': habilitarConcatRem,
  'eliminar-entrada-lre': eliminarEntradaLre,
  'eliminar-salida-tara-lrs': eliminarSalidaTaraLrs,
  'permitir-pesaje-manual': permitirPesajeManual,
};

export function getFormDefinition(slug: FormSlug): FormDefinition | null {
  return REGISTRY[slug] ?? null;
}

export function getPublicDefinition(slug: FormSlug): FormPublicDefinition | null {
  const def = REGISTRY[slug];
  return def ? toPublicDefinition(def) : null;
}

export function listImplementedSlugs(): FormSlug[] {
  return Object.keys(REGISTRY) as FormSlug[];
}

export type FormListItem = {
  slug: FormSlug;
  title: string;
  subtitle: string;
};

function toListItem(def: FormDefinition): FormListItem {
  return { slug: def.slug, title: def.title, subtitle: def.subtitle };
}

/**
 * Lista ligera (solo slug/title/subtitle) de formularios que el usuario puede ver.
 * Usada por /api/auth/me y /api/forms. La FormPublicDefinition completa se pide
 * on-demand en /api/forms/:slug.
 */
export async function getFormsForUser(user: Usuario): Promise<FormListItem[]> {
  const allowed = await getSlugsForUser(user);
  const implemented = new Set(listImplementedSlugs());
  return allowed
    .filter((slug) => implemented.has(slug))
    .map((slug) => toListItem(REGISTRY[slug] as FormDefinition));
}
