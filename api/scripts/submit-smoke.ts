/**
 * Smoke test punta-a-punta de Fase 3:
 *   1. Pick un proveedor Transportista existente en BDADN.
 *   2. Verifica que la placa sintetica PLACATEST001 no existe (cleanup defensivo).
 *   3. POST /api/forms/registrar-unidad-adn/submit con DEV_BYPASS.
 *   4. Confirma insercion en BDADN.Placa.
 *   5. Confirma fila en plataforma.SubmissionLog con result='ok'.
 *   6. Confirma que no hay fila en NotificationQueue.
 *   7. Cleanup: DELETE de la placa y del SubmissionLog creado.
 *
 * Uso: tsx scripts/submit-smoke.ts
 */
import { PrismaClient } from '@prisma/client';

import { closePool, getPool } from '../src/mssql.js';

const prisma = new PrismaClient();
const API = 'http://localhost:3001';
const TEST_PLACA = 'PLACATEST001';
const TEST_NUM_ECON = 'TEST001';

type SubmitResponse =
  | { ok: true; status: number; submissionId: string; durationMs: number }
  | { ok: false; status: number | null; error: string; submissionId?: string; issues?: unknown };

async function pickTransportista(): Promise<string> {
  const pool = await getPool();
  const r = await pool
    .request()
    .query<{ NombreProveedor: string }>(
      "SELECT TOP 1 NombreProveedor FROM Proveedor WHERE TipoProveedor = 'Transportista' ORDER BY NombreProveedor",
    );
  const name = r.recordset[0]?.NombreProveedor;
  if (!name) throw new Error('No hay ningun proveedor Transportista en BDADN');
  return name;
}

async function placaExists(placa: string): Promise<boolean> {
  const pool = await getPool();
  const r = await pool.request().input('p', placa).query<{ n: number }>('SELECT COUNT(*) AS n FROM Placa WHERE PlacaTracto = @p');
  return (r.recordset[0]?.n ?? 0) > 0;
}

async function deletePlacaIfExists(placa: string): Promise<number> {
  const pool = await getPool();
  const r = await pool.request().input('p', placa).query('DELETE FROM Placa WHERE PlacaTracto = @p');
  return r.rowsAffected[0] ?? 0;
}

async function submit(body: unknown): Promise<{ status: number; data: SubmitResponse }> {
  const res = await fetch(`${API}/api/forms/registrar-unidad-adn/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as SubmitResponse;
  return { status: res.status, data };
}

async function main(): Promise<void> {
  let exitCode = 0;
  let submissionLogId: string | null = null;

  try {
    console.log('=== 1. Pick proveedor Transportista ===');
    const proveedor = await pickTransportista();
    console.log(`   proveedor elegido: "${proveedor}"`);

    console.log(`\n=== 2. Cleanup defensivo (${TEST_PLACA}) ===`);
    const preDeleted = await deletePlacaIfExists(TEST_PLACA);
    console.log(`   filas borradas antes: ${preDeleted}`);

    console.log('\n=== 3. POST submit con placa sintetica ===');
    const { status, data } = await submit({
      NombreProveedor: proveedor,
      NumEconomicoInput: TEST_NUM_ECON,
      PlacaInput: TEST_PLACA,
    });
    console.log(`   HTTP ${status}`, data);
    if (status !== 200 || !data.ok) throw new Error('submit fallo: ' + JSON.stringify(data));
    submissionLogId = data.submissionId;

    console.log('\n=== 4. Verificar insercion en BDADN.Placa ===');
    const inserted = await placaExists(TEST_PLACA);
    console.log(`   placa existe: ${inserted}`);
    if (!inserted) throw new Error('placa no se inserto');

    console.log('\n=== 5. Verificar SubmissionLog ===');
    const log = await prisma.submissionLog.findUnique({ where: { id: submissionLogId } });
    console.log(`   result=${log?.result} duration_ms=${log?.duration_ms} sp=${log?.sp_name}`);
    if (log?.result !== 'ok') throw new Error('SubmissionLog no quedo como ok');

    console.log('\n=== 6. Verificar NotificationQueue vacia (sin error) ===');
    const notifs = await prisma.notificationQueue.count({ where: { submission_id: submissionLogId } });
    console.log(`   notifs para este submission: ${notifs}`);
    if (notifs !== 0) throw new Error('se encolaron notifs para un submit exitoso');

    console.log('\n=== 7. Probar validacion de negocio (placa duplicada) ===');
    const dupe = await submit({
      NombreProveedor: proveedor,
      NumEconomicoInput: TEST_NUM_ECON + '_DUP',
      PlacaInput: TEST_PLACA,
    });
    console.log(`   HTTP ${dupe.status}`, dupe.data);
    if (dupe.status !== 400 || dupe.data.ok !== false) throw new Error('la placa duplicada deberia fallar con 400');
    const dupNotifs = await prisma.notificationQueue.count({
      where: { submission_id: (dupe.data as { submissionId?: string }).submissionId },
    });
    console.log(`   notifs para el fallo de negocio: ${dupNotifs} (esperado 1)`);
    if (dupNotifs !== 1) throw new Error('no se encolo notificacion en el fallo');

    console.log('\n=== 8. Probar body invalido (zod 400) ===');
    const bad = await submit({ NombreProveedor: '' });
    console.log(`   HTTP ${bad.status}`, bad.data);
    if (bad.status !== 400) throw new Error('body invalido deberia ser 400');
  } catch (err) {
    exitCode = 1;
    console.error('\nSMOKE FAIL:', err);
  } finally {
    console.log('\n=== cleanup ===');
    const deleted = await deletePlacaIfExists(TEST_PLACA);
    console.log(`   placas borradas: ${deleted}`);

    // borra los SubmissionLog y NotificationQueue del smoke (para no ensuciar)
    const sLogs = await prisma.submissionLog.deleteMany({
      where: { form_slug: 'registrar-unidad-adn', payload_json: { contains: TEST_PLACA } },
    });
    const sNotifs = await prisma.notificationQueue.deleteMany({
      where: { payload_json: { contains: TEST_PLACA } },
    });
    console.log(`   SubmissionLog borrados: ${sLogs.count}`);
    console.log(`   NotificationQueue borrados: ${sNotifs.count}`);

    await prisma.$disconnect();
    await closePool();
  }

  console.log(exitCode === 0 ? '\nSMOKE OK' : '\nSMOKE FAIL');
  process.exit(exitCode);
}

main();
