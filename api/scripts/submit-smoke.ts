/**
 * Smoke test punta-a-punta del handler generico POST /api/forms/:slug/submit
 * para los 11 formularios (Tanda 1 + Tanda 2 de Fase 4).
 *
 * Filosofia de seguridad con BDADN productivo:
 *   - Tanda 1 (inserciones): inserta, verifica, borra al final.
 *   - Tanda 2 eliminar-*:    usa IDs claramente inexistentes (999999999)
 *                            y espera el error de negocio "no encontrado".
 *   - Tanda 2 reversibles:   lee estado actual, cambia al opuesto, verifica,
 *                            restaura al estado original.
 *   - Tanda 2 registrar-proveedor: inserta Transportista Cliente sintetico,
 *                                  verifica ID auto-asignado, borra.
 *
 * Uso: tsx scripts/submit-smoke.ts
 */
import { PrismaClient } from '@prisma/client';

import { closePool, getPool } from '../src/mssql.js';

const prisma = new PrismaClient();
const API = 'http://localhost:3001';
const ADMIN_EMAIL = 'operacionesadn@adnenergia.com';

const TEST = {
  // Tanda 1
  placaAdn: 'PLACAADN001',
  placaCliente: 'PLACACLI001',
  numEconAdn: 'TESTFZADN',
  numEconCliente: 'TESTFZCLI',
  operadorAdn: 'test operador adn uno',
  operadorCliente: 'test operador cliente uno',
  placaRemolque: 'REMOL001',
  numEconRemolque: 'TESTREM',
  // Tanda 2
  proveedorSinteticoNombre: 'TEST PROVEEDOR SMOKE',
  bigFolio: 999_999_999,
} as const;

type ApiResponse =
  | {
      ok: true;
      submissionId: string;
      successMessage: string;
      durationMs: number;
      output: Record<string, unknown>;
      recordset: unknown;
    }
  | {
      ok: false;
      error: string;
      status?: number | null;
      issues?: unknown;
      submissionId?: string;
    };

async function submit(
  slug: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: ApiResponse }> {
  const res = await fetch(`${API}/api/forms/${slug}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as ApiResponse;
  return { status: res.status, data };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

async function pickProveedor(tipo: 'Transportista' | 'Transportista Cliente'): Promise<string> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('t', tipo)
    .query<{ NombreProveedor: string }>(
      'SELECT TOP 1 NombreProveedor FROM dbo.Proveedor WHERE TipoProveedor = @t ORDER BY NombreProveedor',
    );
  const name = r.recordset[0]?.NombreProveedor;
  if (!name) throw new Error(`No hay proveedores ${tipo}`);
  return name;
}

async function pickCentroDestino(): Promise<string> {
  const pool = await getPool();
  const r = await pool
    .request()
    .query<{ CentroDestino: string; ConcatRemisionExt: boolean | number }>(
      "SELECT TOP 1 CONCAT(IDCentro, ' - ', Destino) AS CentroDestino, ConcatRemisionExt FROM dbo.Destino ORDER BY IDCentro, Destino",
    );
  const v = r.recordset[0]?.CentroDestino;
  if (!v) throw new Error('No hay registros en Destino');
  return v;
}

async function readConcatRem(centroDestino: string): Promise<boolean> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('v', centroDestino)
    .query<{ ConcatRemisionExt: boolean | number }>(
      "SELECT ConcatRemisionExt FROM dbo.Destino WHERE CONCAT(IDCentro, ' - ', Destino) = @v",
    );
  const raw = r.recordset[0]?.ConcatRemisionExt;
  return raw === true || raw === 1;
}

async function pickCentroPesaje(): Promise<{ id: number; allowManual: number }> {
  const pool = await getPool();
  const r = await pool
    .request()
    .query<{ IDCentro: number; AllowManual: boolean | number }>(
      'SELECT TOP 1 pc.IDCentro, pc.AllowManual FROM dbo.PesajeCentro pc INNER JOIN dbo.Centro c ON c.IDCentro = pc.IDCentro ORDER BY pc.IDCentro',
    );
  const row = r.recordset[0];
  if (!row) throw new Error('No hay PesajeCentro configurado');
  return { id: Number(row.IDCentro), allowManual: Number(row.AllowManual) };
}

async function readAllowManual(idCentro: number): Promise<number> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('id', idCentro)
    .query<{ AllowManual: boolean | number }>(
      'SELECT AllowManual FROM dbo.PesajeCentro WHERE IDCentro = @id',
    );
  return Number(r.recordset[0]?.AllowManual ?? 0);
}

async function cleanupPlaca(placa: string): Promise<number> {
  const pool = await getPool();
  const r = await pool.request().input('p', placa).query('DELETE FROM dbo.Placa WHERE PlacaTracto = @p');
  return r.rowsAffected[0] ?? 0;
}

async function cleanupOperador(nombre: string): Promise<number> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('n', nombre)
    .query('DELETE FROM dbo.Operador WHERE LOWER(NombreOperador) = LOWER(@n)');
  return r.rowsAffected[0] ?? 0;
}

async function cleanupPlacaRemolque(placa: string): Promise<number> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('p', placa)
    .query('DELETE FROM dbo.PlacaRemolque WHERE PlacaRemolque = @p');
  return r.rowsAffected[0] ?? 0;
}

async function cleanupProveedorSintetico(): Promise<number> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('n', TEST.proveedorSinteticoNombre)
    .query('DELETE FROM dbo.Proveedor WHERE NombreProveedor = @n');
  return r.rowsAffected[0] ?? 0;
}

async function placaExists(placa: string): Promise<boolean> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('p', placa)
    .query<{ n: number }>('SELECT COUNT(*) AS n FROM dbo.Placa WHERE PlacaTracto = @p');
  return (r.recordset[0]?.n ?? 0) > 0;
}

async function operadorExists(nombre: string): Promise<boolean> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('n', nombre)
    .query<{ n: number }>('SELECT COUNT(*) AS n FROM dbo.Operador WHERE LOWER(NombreOperador) = LOWER(@n)');
  return (r.recordset[0]?.n ?? 0) > 0;
}

async function placaRemolqueExists(placa: string): Promise<boolean> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('p', placa)
    .query<{ n: number }>('SELECT COUNT(*) AS n FROM dbo.PlacaRemolque WHERE PlacaRemolque = @p');
  return (r.recordset[0]?.n ?? 0) > 0;
}

type Scenario = { name: string; run: () => Promise<void> };

async function main(): Promise<void> {
  let failed = 0;
  const results: { name: string; ok: boolean; error?: string }[] = [];

  // Restaurar admin (por si quedo mutado de un smoke anterior)
  await prisma.usuario.update({ where: { email: ADMIN_EMAIL }, data: { rol: 'administrador' } });

  // Cleanup defensivo previo
  await Promise.all([
    cleanupPlaca(TEST.placaAdn),
    cleanupPlaca(TEST.placaAdn + 'B'),
    cleanupPlaca(TEST.placaCliente),
    cleanupOperador(TEST.operadorAdn),
    cleanupOperador(TEST.operadorCliente),
    cleanupPlacaRemolque(TEST.placaRemolque),
    cleanupProveedorSintetico(),
  ]);

  const scenarios: Scenario[] = [
    {
      name: 'GET /api/auth/me devuelve admin + 11 forms implementados',
      async run() {
        const body = await getJson<{ user: { rol: string }; forms: { slug: string }[] }>('/api/auth/me');
        if (body.user.rol !== 'administrador') throw new Error(`rol esperado administrador, vino ${body.user.rol}`);
        if (body.forms.length !== 11) throw new Error(`esperaba 11 forms, vino ${body.forms.length}`);
      },
    },
    {
      name: 'GET /api/forms/eliminar-tara devuelve fields',
      async run() {
        const body = await getJson<{ form: { fields: unknown[] } }>('/api/forms/eliminar-tara');
        if (body.form.fields.length !== 1) throw new Error(`esperaba 1 field, vino ${body.form.fields.length}`);
      },
    },
    {
      name: 'GET /api/catalogos/centros-pesaje devuelve opciones',
      async run() {
        const body = await getJson<{ options: { value: string; label: string }[] }>('/api/catalogos/centros-pesaje');
        if (body.options.length === 0) throw new Error('catalogo vacio');
      },
    },

    // ---- Tanda 1 (5 operativos, happy paths + errores) ----
    {
      name: '[T1] registrar-unidad-adn happy path',
      async run() {
        const proveedor = await pickProveedor('Transportista');
        const r = await submit('registrar-unidad-adn', {
          NombreProveedor: proveedor,
          NumEconomicoInput: TEST.numEconAdn,
          PlacaInput: TEST.placaAdn,
        });
        if (r.status !== 200 || !r.data.ok) throw new Error(JSON.stringify(r));
        if (!(await placaExists(TEST.placaAdn))) throw new Error('placa no inserto');
        await cleanupPlaca(TEST.placaAdn);
      },
    },
    {
      name: '[T1] registrar-unidad-cliente happy path',
      async run() {
        const proveedor = await pickProveedor('Transportista Cliente');
        const r = await submit('registrar-unidad-cliente', {
          NombreProveedor: proveedor,
          NumEconomicoInput: TEST.numEconCliente,
          PlacaInput: TEST.placaCliente,
        });
        if (r.status !== 200 || !r.data.ok) throw new Error(JSON.stringify(r));
        if (!(await placaExists(TEST.placaCliente))) throw new Error('placa no inserto');
        await cleanupPlaca(TEST.placaCliente);
      },
    },
    {
      name: '[T1] registrar-operador-adn happy path',
      async run() {
        const proveedor = await pickProveedor('Transportista');
        const r = await submit('registrar-operador-adn', {
          NombreProveedor: proveedor,
          NombreOperadorInput: TEST.operadorAdn,
        });
        if (r.status !== 200 || !r.data.ok) throw new Error(JSON.stringify(r));
        if (!(await operadorExists(TEST.operadorAdn))) throw new Error('operador no inserto');
        await cleanupOperador(TEST.operadorAdn);
      },
    },
    {
      name: '[T1] registrar-operador-cliente happy path',
      async run() {
        const proveedor = await pickProveedor('Transportista Cliente');
        const r = await submit('registrar-operador-cliente', {
          NombreProveedor: proveedor,
          NombreOperadorInput: TEST.operadorCliente,
        });
        if (r.status !== 200 || !r.data.ok) throw new Error(JSON.stringify(r));
        if (!(await operadorExists(TEST.operadorCliente))) throw new Error('operador no inserto');
        await cleanupOperador(TEST.operadorCliente);
      },
    },
    {
      name: '[T1] placa-remolque happy path',
      async run() {
        const r = await submit('placa-remolque', {
          NombreProveedor: 'ADN Transporte',
          PlacaInput: TEST.placaRemolque,
          NumEconomicoInput: TEST.numEconRemolque,
        });
        if (r.status !== 200 || !r.data.ok) throw new Error(JSON.stringify(r));
        if (!(await placaRemolqueExists(TEST.placaRemolque))) throw new Error('remolque no inserto');
        await cleanupPlacaRemolque(TEST.placaRemolque);
      },
    },

    // ---- Tanda 2 ----
    {
      name: '[T2] eliminar-tara con folio inexistente -> error de negocio',
      async run() {
        const r = await submit('eliminar-tara', { FolioProcesoCarga: TEST.bigFolio });
        if (r.status !== 400 || r.data.ok !== false) throw new Error(`esperaba 400, vino ${r.status}`);
        if (!r.data.error.toLowerCase().includes('no se encontr')) {
          throw new Error(`mensaje inesperado: ${r.data.error}`);
        }
      },
    },
    {
      name: '[T2] registrar-proveedor (Transportista Cliente con ID auto)',
      async run() {
        const r = await submit('registrar-proveedor', {
          NombreProveedor: TEST.proveedorSinteticoNombre,
          TipoProveedor: 'Transportista Cliente',
        });
        if (r.status !== 200 || !r.data.ok) throw new Error(JSON.stringify(r));
        const idAsignado = r.data.output?.['IDProveedorAsignado'];
        if (idAsignado === undefined || idAsignado === null) throw new Error('no devolvio IDProveedorAsignado');
        // Cleanup
        const count = await cleanupProveedorSintetico();
        if (count < 1) throw new Error('cleanup no encontro el proveedor sintetico');
      },
    },
    {
      name: '[T2] habilitar-concat-rem (cambia y revierte)',
      async run() {
        const centroDestino = await pickCentroDestino();
        const original = await readConcatRem(centroDestino);
        const target = original ? 'Deshabilitado' : 'Habilitado';
        const revertir = original ? 'Habilitado' : 'Deshabilitado';

        const r1 = await submit('habilitar-concat-rem', { CentroDestino: centroDestino, Estatus: target });
        if (r1.status !== 200 || !r1.data.ok) throw new Error(`cambio fallo: ${JSON.stringify(r1)}`);
        const mid = await readConcatRem(centroDestino);
        if (mid === original) throw new Error('estado no cambio');

        const r2 = await submit('habilitar-concat-rem', { CentroDestino: centroDestino, Estatus: revertir });
        if (r2.status !== 200 || !r2.data.ok) throw new Error(`reversion fallo: ${JSON.stringify(r2)}`);
        const final = await readConcatRem(centroDestino);
        if (final !== original) throw new Error('estado no se restauro');
      },
    },
    {
      name: '[T2] eliminar-entrada-lre con datos inexistentes -> error de negocio',
      async run() {
        const r = await submit('eliminar-entrada-lre', {
          TipoEntrada: 'Compra',
          EntregaOC: TEST.bigFolio,
          DocumentoMaterial: TEST.bigFolio,
        });
        if (r.status !== 400 || r.data.ok !== false) throw new Error(`esperaba 400, vino ${r.status}`);
        if (!r.data.error.toLowerCase().includes('no existe')) {
          throw new Error(`mensaje inesperado: ${r.data.error}`);
        }
      },
    },
    {
      name: '[T2] eliminar-salida-tara-lrs con entrega inexistente -> error de negocio',
      async run() {
        const r = await submit('eliminar-salida-tara-lrs', { Entrega: TEST.bigFolio });
        if (r.status !== 400 || r.data.ok !== false) throw new Error(`esperaba 400, vino ${r.status}`);
      },
    },
    {
      name: '[T2] permitir-pesaje-manual (toggle y revierte)',
      async run() {
        const centro = await pickCentroPesaje();
        const opuesto = centro.allowManual === 1 ? 0 : 1;

        // IDCentro viaja como string (asi lo emite el catalogo centros-pesaje);
        // AllowManual tambien (radio con values '0'/'1'). El driver mssql los convierte a BIGINT/INT.
        const r1 = await submit('permitir-pesaje-manual', {
          IDCentro: String(centro.id),
          AllowManual: String(opuesto),
        });
        if (r1.status !== 200 || !r1.data.ok) throw new Error(`cambio fallo: ${JSON.stringify(r1)}`);
        const mid = await readAllowManual(centro.id);
        if (mid !== opuesto) throw new Error(`AllowManual esperado ${opuesto}, vino ${mid}`);

        const r2 = await submit('permitir-pesaje-manual', {
          IDCentro: String(centro.id),
          AllowManual: String(centro.allowManual),
        });
        if (r2.status !== 200 || !r2.data.ok) throw new Error(`reversion fallo: ${JSON.stringify(r2)}`);
        const final = await readAllowManual(centro.id);
        if (final !== centro.allowManual) throw new Error('AllowManual no se restauro');
      },
    },

    // ---- Generico ----
    {
      name: 'submit body invalido (zod 400)',
      async run() {
        const r = await submit('registrar-unidad-adn', { NombreProveedor: '' });
        if (r.status !== 400) throw new Error(`esperaba 400, vino ${r.status}`);
      },
    },
    {
      name: 'submit slug desconocido (404 JSON)',
      async run() {
        const r = await submit('no-existe', {});
        if (r.status !== 404) throw new Error(`esperaba 404, vino ${r.status}`);
      },
    },
  ];

  for (const s of scenarios) {
    try {
      await s.run();
      results.push({ name: s.name, ok: true });
      console.log(`  OK   ${s.name}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: s.name, ok: false, error: msg });
      console.log(`  FAIL ${s.name}`);
      console.log(`       ${msg}`);
    }
  }

  console.log('\n--- cleanup final ---');
  await Promise.all([
    cleanupPlaca(TEST.placaAdn),
    cleanupPlaca(TEST.placaAdn + 'B'),
    cleanupPlaca(TEST.placaCliente),
    cleanupOperador(TEST.operadorAdn),
    cleanupOperador(TEST.operadorCliente),
    cleanupPlacaRemolque(TEST.placaRemolque),
    cleanupProveedorSintetico(),
  ]);
  const delLogs = await prisma.submissionLog.deleteMany({
    where: {
      OR: [
        { payload_json: { contains: TEST.placaAdn } },
        { payload_json: { contains: TEST.placaCliente } },
        { payload_json: { contains: TEST.operadorAdn } },
        { payload_json: { contains: TEST.operadorCliente } },
        { payload_json: { contains: TEST.placaRemolque } },
        { payload_json: { contains: TEST.proveedorSinteticoNombre } },
        { payload_json: { contains: String(TEST.bigFolio) } },
      ],
    },
  });
  const delNotifs = await prisma.notificationQueue.deleteMany({
    where: {
      OR: [
        { payload_json: { contains: TEST.placaAdn } },
        { payload_json: { contains: TEST.placaCliente } },
        { payload_json: { contains: TEST.operadorAdn } },
        { payload_json: { contains: TEST.operadorCliente } },
        { payload_json: { contains: TEST.placaRemolque } },
        { payload_json: { contains: TEST.proveedorSinteticoNombre } },
        { payload_json: { contains: String(TEST.bigFolio) } },
      ],
    },
  });
  console.log(`  SubmissionLog borrados: ${delLogs.count}`);
  console.log(`  NotificationQueue borrados: ${delNotifs.count}`);

  await prisma.$disconnect();
  await closePool();

  console.log(`\n--- SUMMARY: ${results.length - failed}/${results.length} escenarios OK ---`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
