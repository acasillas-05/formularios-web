/**
 * Smoke test punta-a-punta del handler generico POST /api/forms/:slug/submit
 * para los 5 formularios operativos (Tanda 1 de Fase 4).
 *
 * Flujo:
 *   0. Restaura rol del admin (DEV_BYPASS) y limpia datos sinteticos previos.
 *   1. Para cada form: pick catalogo real, submit con valores sinteticos,
 *      verifica la insercion en BDADN, limpia la fila insertada.
 *   2. Ejecuta tambien un caso de error de negocio por duplicado.
 *   3. Al final borra SubmissionLog/NotificationQueue generados.
 *
 * Uso: tsx scripts/submit-smoke.ts
 */
import { PrismaClient } from '@prisma/client';

import { closePool, getPool } from '../src/mssql.js';

const prisma = new PrismaClient();
const API = 'http://localhost:3001';
const ADMIN_EMAIL = 'operacionesadn@adnenergia.com';

const TEST = {
  placaAdn: 'PLACAADN001',
  placaCliente: 'PLACACLI001',
  numEconAdn: 'TESTFZADN',
  numEconCliente: 'TESTFZCLI',
  operadorAdn: 'test operador adn uno',
  operadorCliente: 'test operador cliente uno',
  placaRemolque: 'REMOL001',
  numEconRemolque: 'TESTREM',
} as const;

type ApiResponse =
  | { ok: true; submissionId: string; successMessage: string; durationMs: number; output: Record<string, unknown>; recordset: unknown }
  | { ok: false; error: string; status?: number | null; issues?: unknown; submissionId?: string };

async function submit(slug: string, body: Record<string, unknown>): Promise<{ status: number; data: ApiResponse }> {
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

async function cleanupPlaca(placa: string): Promise<number> {
  const pool = await getPool();
  const r = await pool.request().input('p', placa).query('DELETE FROM dbo.Placa WHERE PlacaTracto = @p');
  return r.rowsAffected[0] ?? 0;
}

async function cleanupOperador(nombre: string): Promise<number> {
  const pool = await getPool();
  // El SP normaliza el nombre a Proper Case. Compara case-insensitive para capturar cualquier variante.
  const r = await pool.request().input('n', nombre).query('DELETE FROM dbo.Operador WHERE LOWER(NombreOperador) = LOWER(@n)');
  return r.rowsAffected[0] ?? 0;
}

async function cleanupPlacaRemolque(placa: string): Promise<number> {
  const pool = await getPool();
  const r = await pool.request().input('p', placa).query('DELETE FROM dbo.PlacaRemolque WHERE PlacaRemolque = @p');
  return r.rowsAffected[0] ?? 0;
}

async function placaExists(placa: string): Promise<boolean> {
  const pool = await getPool();
  const r = await pool.request().input('p', placa).query<{ n: number }>('SELECT COUNT(*) AS n FROM dbo.Placa WHERE PlacaTracto = @p');
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

type Scenario = {
  name: string;
  run: () => Promise<void>;
};

async function main(): Promise<void> {
  let failed = 0;
  const results: { name: string; ok: boolean; error?: string }[] = [];

  // Restaurar admin (por si quedo mutado de un smoke anterior)
  await prisma.usuario.update({ where: { email: ADMIN_EMAIL }, data: { rol: 'administrador' } });

  // Cleanup defensivo previo
  await Promise.all([
    cleanupPlaca(TEST.placaAdn),
    cleanupPlaca(TEST.placaCliente),
    cleanupOperador(TEST.operadorAdn),
    cleanupOperador(TEST.operadorCliente),
    cleanupPlacaRemolque(TEST.placaRemolque),
  ]);

  const scenarios: Scenario[] = [
    {
      name: 'GET /api/auth/me devuelve admin + forms implementados',
      async run() {
        const body = await getJson<{ user: { rol: string }; forms: { slug: string }[] }>('/api/auth/me');
        if (body.user.rol !== 'administrador') throw new Error(`rol esperado administrador, vino ${body.user.rol}`);
        if (body.forms.length !== 5) throw new Error(`esperaba 5 forms de Tanda 1, vino ${body.forms.length}`);
      },
    },
    {
      name: 'GET /api/forms/registrar-unidad-adn devuelve fields',
      async run() {
        const body = await getJson<{ form: { fields: unknown[] } }>('/api/forms/registrar-unidad-adn');
        if (body.form.fields.length !== 3) throw new Error(`esperaba 3 fields, vino ${body.form.fields.length}`);
      },
    },
    {
      name: 'GET /api/catalogos/proveedores-transportista devuelve opciones',
      async run() {
        const body = await getJson<{ options: { value: string; label: string }[] }>('/api/catalogos/proveedores-transportista');
        if (body.options.length === 0) throw new Error('catalogo vacio');
      },
    },
    {
      name: 'submit registrar-unidad-adn (happy path)',
      async run() {
        const proveedor = await pickProveedor('Transportista');
        const r = await submit('registrar-unidad-adn', {
          NombreProveedor: proveedor,
          NumEconomicoInput: TEST.numEconAdn,
          PlacaInput: TEST.placaAdn,
        });
        if (r.status !== 200 || !r.data.ok) throw new Error(`submit fallo: ${JSON.stringify(r)}`);
        if (!(await placaExists(TEST.placaAdn))) throw new Error('placa no se inserto');
        await cleanupPlaca(TEST.placaAdn);
      },
    },
    {
      name: 'submit registrar-unidad-cliente (happy path)',
      async run() {
        const proveedor = await pickProveedor('Transportista Cliente');
        const r = await submit('registrar-unidad-cliente', {
          NombreProveedor: proveedor,
          NumEconomicoInput: TEST.numEconCliente,
          PlacaInput: TEST.placaCliente,
        });
        if (r.status !== 200 || !r.data.ok) throw new Error(`submit fallo: ${JSON.stringify(r)}`);
        if (!(await placaExists(TEST.placaCliente))) throw new Error('placa no se inserto');
        await cleanupPlaca(TEST.placaCliente);
      },
    },
    {
      name: 'submit registrar-operador-adn (happy path)',
      async run() {
        const proveedor = await pickProveedor('Transportista');
        const r = await submit('registrar-operador-adn', {
          NombreProveedor: proveedor,
          NombreOperadorInput: TEST.operadorAdn,
        });
        if (r.status !== 200 || !r.data.ok) throw new Error(`submit fallo: ${JSON.stringify(r)}`);
        if (!(await operadorExists(TEST.operadorAdn))) throw new Error('operador no se inserto');
        await cleanupOperador(TEST.operadorAdn);
      },
    },
    {
      name: 'submit registrar-operador-cliente (happy path)',
      async run() {
        const proveedor = await pickProveedor('Transportista Cliente');
        const r = await submit('registrar-operador-cliente', {
          NombreProveedor: proveedor,
          NombreOperadorInput: TEST.operadorCliente,
        });
        if (r.status !== 200 || !r.data.ok) throw new Error(`submit fallo: ${JSON.stringify(r)}`);
        if (!(await operadorExists(TEST.operadorCliente))) throw new Error('operador no se inserto');
        await cleanupOperador(TEST.operadorCliente);
      },
    },
    {
      name: 'submit placa-remolque (happy path, ADN Transporte)',
      async run() {
        const r = await submit('placa-remolque', {
          NombreProveedor: 'ADN Transporte',
          PlacaInput: TEST.placaRemolque,
          NumEconomicoInput: TEST.numEconRemolque,
        });
        if (r.status !== 200 || !r.data.ok) throw new Error(`submit fallo: ${JSON.stringify(r)}`);
        if (!(await placaRemolqueExists(TEST.placaRemolque))) throw new Error('placa remolque no se inserto');
        await cleanupPlacaRemolque(TEST.placaRemolque);
      },
    },
    {
      name: 'submit registrar-unidad-adn con body invalido (zod 400)',
      async run() {
        const r = await submit('registrar-unidad-adn', { NombreProveedor: '' });
        if (r.status !== 400) throw new Error(`esperaba 400, vino ${r.status}`);
      },
    },
    {
      name: 'submit slug desconocido (404 JSON)',
      async run() {
        const r = await submit('no-existe' as string, {});
        if (r.status !== 404) throw new Error(`esperaba 404, vino ${r.status}`);
      },
    },
    {
      name: 'submit placa duplicada (400 con mensaje del SP + notificacion)',
      async run() {
        const proveedor = await pickProveedor('Transportista');
        // insert
        const a = await submit('registrar-unidad-adn', {
          NombreProveedor: proveedor,
          NumEconomicoInput: TEST.numEconAdn + '_B',
          PlacaInput: TEST.placaAdn + 'B',
        });
        if (a.status !== 200) throw new Error('pre-insert fallo');
        // duplicate
        const b = await submit('registrar-unidad-adn', {
          NombreProveedor: proveedor,
          NumEconomicoInput: TEST.numEconAdn + '_C',
          PlacaInput: TEST.placaAdn + 'B',
        });
        if (b.status !== 400) throw new Error(`esperaba 400 dup, vino ${b.status}`);
        await cleanupPlaca(TEST.placaAdn + 'B');
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

  console.log('\n--- cleanup ---');
  await Promise.all([
    cleanupPlaca(TEST.placaAdn),
    cleanupPlaca(TEST.placaAdn + 'B'),
    cleanupPlaca(TEST.placaCliente),
    cleanupOperador(TEST.operadorAdn),
    cleanupOperador(TEST.operadorCliente),
    cleanupPlacaRemolque(TEST.placaRemolque),
  ]);
  const delLogs = await prisma.submissionLog.deleteMany({
    where: {
      OR: [
        { form_slug: 'registrar-unidad-adn', payload_json: { contains: TEST.placaAdn } },
        { form_slug: 'registrar-unidad-cliente', payload_json: { contains: TEST.placaCliente } },
        { form_slug: 'registrar-operador-adn', payload_json: { contains: TEST.operadorAdn } },
        { form_slug: 'registrar-operador-cliente', payload_json: { contains: TEST.operadorCliente } },
        { form_slug: 'placa-remolque', payload_json: { contains: TEST.placaRemolque } },
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
