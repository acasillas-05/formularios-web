import sql from 'mssql';

import { config } from './config.js';

/**
 * Pool singleton hacia BDADN (SQL Server Azure).
 * Inicializacion lazy: la primera llamada a getPool() abre la conexion.
 * Se cierra automaticamente en shutdown via closePool().
 */
let pool: sql.ConnectionPool | null = null;
let connectingPromise: Promise<sql.ConnectionPool> | null = null;

/**
 * BDADN_SERVER viene en formato "host,port" (estilo tsql). El driver mssql
 * espera server y port separados. Si no viene coma, asume el puerto default.
 */
function parseServer(raw: string): { server: string; port: number } {
  const [host, portStr] = raw.split(',').map((s) => s.trim());
  const port = portStr ? Number.parseInt(portStr, 10) : 1433;
  return { server: host ?? '', port: Number.isNaN(port) ? 1433 : port };
}

function buildConfig(): sql.config {
  const { server, port } = parseServer(config.bdadn.server);
  return {
    server,
    port,
    database: config.bdadn.database,
    user: config.bdadn.user,
    password: config.bdadn.password,
    options: {
      encrypt: config.bdadn.encrypt,
      trustServerCertificate: config.bdadn.trustServerCertificate,
      enableArithAbort: true,
    },
    pool: {
      min: config.bdadn.poolMin,
      max: config.bdadn.poolMax,
      idleTimeoutMillis: 30_000,
    },
    connectionTimeout: config.bdadn.connectTimeoutMs,
    requestTimeout: config.bdadn.requestTimeoutMs,
  };
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    const cfg = buildConfig();
    if (!cfg.server || !cfg.user || !cfg.password || !cfg.database) {
      throw new Error('BDADN no esta configurado (faltan server/database/user/password en .env)');
    }
    const p = new sql.ConnectionPool(cfg);
    p.on('error', (err) => {
      console.error('[mssql] pool error:', err.message);
    });
    await p.connect();
    console.log(`[mssql] pool conectado a ${cfg.server}:${cfg.port}/${cfg.database}`);
    pool = p;
    connectingPromise = null;
    return p;
  })().catch((err) => {
    connectingPromise = null;
    throw err;
  });

  return connectingPromise;
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  const p = pool;
  pool = null;
  try {
    await p.close();
    console.log('[mssql] pool cerrado');
  } catch (err) {
    console.error('[mssql] error cerrando pool:', err);
  }
}

export { sql };
