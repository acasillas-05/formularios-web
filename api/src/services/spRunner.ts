import type { IRecordSet } from 'mssql';

import { getPool, sql } from '../mssql.js';

/**
 * Tipos SQL Server soportados para parametros de SPs.
 * Se mapean a los wrappers tipados de mssql en toSqlType().
 */
export type SpParamType =
  | { kind: 'NVARCHAR'; length: number | 'MAX' }
  | { kind: 'VARCHAR'; length: number | 'MAX' }
  | { kind: 'INT' }
  | { kind: 'SMALLINT' }
  | { kind: 'BIGINT' }
  | { kind: 'BIT' }
  | { kind: 'DECIMAL'; precision: number; scale: number };

export type SpInput = {
  /** Nombre del parametro sin el prefijo @. */
  name: string;
  type: SpParamType;
  /** Valor a enviar. null se pasa como NULL al SP. */
  value: unknown;
};

export type SpOutput = {
  name: string;
  type: SpParamType;
};

export type SpExecution = {
  /** Nombre completo del SP (normalmente "sp_Xxx" en schema dbo). */
  spName: string;
  inputs?: SpInput[];
  outputs?: SpOutput[];
};

export type SpResult = {
  /** Todos los resultsets devueltos por el SP. Vacio si el SP no devuelve rows. */
  recordsets: IRecordSet<Record<string, unknown>>[];
  /** Primer resultset si existe, para conveniencia. */
  recordset: IRecordSet<Record<string, unknown>> | null;
  /** Parametros OUTPUT indexados por nombre (sin @). */
  output: Record<string, unknown>;
  /** returnValue del SP (0 si no hizo RETURN N). */
  returnValue: number;
  rowsAffected: number[];
  /** Duracion total de la invocacion en ms (no solo la query). */
  durationMs: number;
};

function toSqlType(t: SpParamType) {
  switch (t.kind) {
    case 'NVARCHAR':
      return t.length === 'MAX' ? sql.NVarChar(sql.MAX) : sql.NVarChar(t.length);
    case 'VARCHAR':
      return t.length === 'MAX' ? sql.VarChar(sql.MAX) : sql.VarChar(t.length);
    case 'INT':
      return sql.Int();
    case 'SMALLINT':
      return sql.SmallInt();
    case 'BIGINT':
      return sql.BigInt();
    case 'BIT':
      return sql.Bit();
    case 'DECIMAL':
      return sql.Decimal(t.precision, t.scale);
  }
}

/**
 * Ejecuta un stored procedure en BDADN con parametros tipados.
 * Maneja las dos convenciones de retorno:
 *  1. OUTPUT params (@Status INT, @Error NVARCHAR(MAX)) — la mayoria
 *  2. Resultset (SELECT @Success, @Estatus) — sp_DeleteTara y sp_DeleteTaraSalidaLRS
 * El caller decide cual consumir segun el SP.
 */
export async function runSp(execution: SpExecution): Promise<SpResult> {
  const pool = await getPool();
  const request = pool.request();

  for (const input of execution.inputs ?? []) {
    request.input(input.name, toSqlType(input.type), input.value);
  }
  for (const output of execution.outputs ?? []) {
    request.output(output.name, toSqlType(output.type));
  }

  const start = Date.now();
  const response = await request.execute<Record<string, unknown>>(execution.spName);
  const durationMs = Date.now() - start;

  const recordsets = (response.recordsets as IRecordSet<Record<string, unknown>>[]) ?? [];
  return {
    recordsets,
    recordset: recordsets[0] ?? null,
    output: (response.output ?? {}) as Record<string, unknown>,
    returnValue: response.returnValue ?? 0,
    rowsAffected: response.rowsAffected ?? [],
    durationMs,
  };
}
