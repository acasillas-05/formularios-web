import { Router, type Request, type Response } from 'express';

import { type CatalogoSlug } from '../lib/formTypes.js';
import { getPool } from '../mssql.js';

type CatalogoOption = { value: string; label: string };

/**
 * Whitelist de queries contra BDADN para los catalogos dinamicos.
 * NUNCA se interpola :tipo en SQL; se hace lookup en este mapa.
 * Las queries devuelven siempre columnas `value` y `label`.
 */
const DYNAMIC: Record<
  Exclude<CatalogoSlug, 'tipos-proveedor'>,
  { query: string; cacheSeconds: number }
> = {
  'proveedores-transportista': {
    query:
      "SELECT NombreProveedor AS value, NombreProveedor AS label FROM dbo.Proveedor WHERE TipoProveedor = 'Transportista' ORDER BY NombreProveedor",
    cacheSeconds: 60,
  },
  'proveedores-transportista-cliente': {
    query:
      "SELECT NombreProveedor AS value, NombreProveedor AS label FROM dbo.Proveedor WHERE TipoProveedor = 'Transportista Cliente' ORDER BY NombreProveedor",
    cacheSeconds: 60,
  },
  'centro-destino': {
    query:
      "SELECT CONCAT(IDCentro, ' - ', Destino) AS value, CONCAT(IDCentro, ' - ', Destino) AS label FROM dbo.Destino ORDER BY IDCentro, Destino",
    cacheSeconds: 60,
  },
  'tipos-entrada': {
    query: 'SELECT TipoEntrada AS value, TipoEntrada AS label FROM dbo.TipoEntrada ORDER BY IDTipoEntrada',
    cacheSeconds: 3_600,
  },
  'centros-pesaje': {
    query:
      "SELECT CAST(c.IDCentro AS NVARCHAR(20)) AS value, CONCAT(c.IDCentro, ' - ', c.NombreCentro) AS label FROM dbo.Centro c INNER JOIN dbo.PesajeCentro pc ON pc.IDCentro = c.IDCentro ORDER BY c.IDCentro",
    cacheSeconds: 3_600,
  },
};

const CONSTANTES: Record<'tipos-proveedor', CatalogoOption[]> = {
  'tipos-proveedor': [
    { value: 'Transportista', label: 'Transportista' },
    { value: 'Transportista Cliente', label: 'Transportista Cliente' },
    { value: 'Materia Prima', label: 'Materia Prima' },
  ],
};

/** Cache en proceso. Expiration por-slug. */
const cache = new Map<string, { expiresAt: number; data: CatalogoOption[] }>();

function isCatalogoSlug(v: string): v is CatalogoSlug {
  return (
    v in DYNAMIC ||
    v in CONSTANTES
  );
}

async function loadCatalogo(slug: CatalogoSlug): Promise<CatalogoOption[]> {
  if (slug in CONSTANTES) {
    return CONSTANTES[slug as keyof typeof CONSTANTES];
  }
  const entry = DYNAMIC[slug as keyof typeof DYNAMIC];
  const cached = cache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const pool = await getPool();
  const result = await pool.request().query<CatalogoOption>(entry.query);
  const data = result.recordset.map((r) => ({
    value: String(r.value),
    label: String(r.label),
  }));
  cache.set(slug, { data, expiresAt: Date.now() + entry.cacheSeconds * 1_000 });
  return data;
}

export const catalogosRouter: Router = Router();

catalogosRouter.get('/:tipo', async (req: Request, res: Response) => {
  const tipo = req.params.tipo;
  if (typeof tipo !== 'string' || !isCatalogoSlug(tipo)) {
    res.status(404).json({ ok: false, error: 'Catalogo desconocido' });
    return;
  }
  const data = await loadCatalogo(tipo);
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.json({ ok: true, catalogo: tipo, options: data });
});
