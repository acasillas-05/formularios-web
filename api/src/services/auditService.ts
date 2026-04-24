import type { Usuario } from '@prisma/client';

import { type FormSlug } from '../lib/roles.js';
import { prisma } from '../prisma.js';
import { runSp, type SpExecution, type SpResult } from './spRunner.js';

/**
 * Resultado normalizado de una submission, independiente de la convencion
 * del SP (OUTPUT params vs resultset con Success/Estatus).
 */
export type AuditedSubmission = {
  ok: boolean;
  /** Codigo del SP si usa @Status OUTPUT. */
  status: number | null;
  /** Mensaje de negocio del SP (de @Error OUTPUT o Estatus del resultset). */
  message: string | null;
  /** Toda la salida del SP, por si el caller necesita algo mas (ej. IDProveedorAsignado). */
  spResult: SpResult;
  submissionId: string;
};

/** Convencion para leer el resultado de SPs sin OUTPUT params. */
function interpretResultset(spResult: SpResult): { ok: boolean; message: string | null } {
  const row = spResult.recordset?.[0];
  if (!row) return { ok: false, message: 'SP no devolvio ninguna fila' };
  const successRaw = row['Success'];
  const estatus = typeof row['Estatus'] === 'string' ? (row['Estatus'] as string) : null;
  const ok = successRaw === 1 || successRaw === true;
  return { ok, message: estatus };
}

/** Convencion para SPs con @Status INT OUTPUT y @Error NVARCHAR(MAX) OUTPUT. */
function interpretOutput(spResult: SpResult): { ok: boolean; status: number | null; message: string | null } {
  const statusRaw = spResult.output['Status'];
  const status = typeof statusRaw === 'number' ? statusRaw : null;
  const message = typeof spResult.output['Error'] === 'string' ? (spResult.output['Error'] as string) : null;
  return { ok: status === 200, status, message };
}

/**
 * Envuelve la ejecucion de un SP con:
 *  1. Registro en SubmissionLog (ok o error).
 *  2. Si hubo error de negocio o sistema, encola en NotificationQueue.
 *  3. Devuelve un AuditedSubmission uniforme.
 *
 * Nunca relanza errores controlados. Si el SP retorno error de negocio, ok=false
 * pero la promesa resuelve. Errores de conexion/SQL *si* relanzan (el errorHandler
 * global los atrapa como 500); en ese caso tambien se deja trace en SubmissionLog.
 */
export async function executeAndAudit(args: {
  user: Usuario;
  formSlug: FormSlug;
  execution: SpExecution;
  /** Cuando true, el resultado se interpreta con Success/Estatus del resultset en lugar de @Status/@Error. */
  resultsetConvention?: boolean;
  payload: unknown;
}): Promise<AuditedSubmission> {
  const { user, formSlug, execution, payload } = args;
  const payloadJson = JSON.stringify(payload);
  const startedAt = Date.now();

  try {
    const spResult = await runSp(execution);
    const durationMs = Date.now() - startedAt;

    const interpreted = args.resultsetConvention
      ? { ...interpretResultset(spResult), status: null as number | null }
      : interpretOutput(spResult);

    const log = await prisma.submissionLog.create({
      data: {
        usuario_id: user.id,
        usuario_email: user.email,
        form_slug: formSlug,
        sp_name: execution.spName,
        payload_json: payloadJson,
        result: interpreted.ok ? 'ok' : 'error',
        error_message: interpreted.ok ? null : interpreted.message,
        duration_ms: durationMs,
      },
    });

    if (!interpreted.ok) {
      await prisma.notificationQueue.create({
        data: {
          submission_id: log.id,
          kind: 'error_submit',
          payload_json: JSON.stringify({
            formSlug,
            spName: execution.spName,
            user: user.email,
            status: interpreted.status,
            message: interpreted.message,
          }),
        },
      });
    }

    return {
      ok: interpreted.ok,
      status: interpreted.status,
      message: interpreted.message,
      spResult,
      submissionId: log.id,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errMsg = err instanceof Error ? err.message : 'Error de sistema';

    const log = await prisma.submissionLog.create({
      data: {
        usuario_id: user.id,
        usuario_email: user.email,
        form_slug: formSlug,
        sp_name: execution.spName,
        payload_json: payloadJson,
        result: 'error',
        error_message: errMsg,
        duration_ms: durationMs,
      },
    });
    await prisma.notificationQueue.create({
      data: {
        submission_id: log.id,
        kind: 'error_submit',
        payload_json: JSON.stringify({
          formSlug,
          spName: execution.spName,
          user: user.email,
          systemError: errMsg,
        }),
      },
    });
    throw err;
  }
}
