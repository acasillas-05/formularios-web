import 'dotenv/config';

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variable de entorno requerida no definida: ${key}`);
  }
  return value;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: envInt('PORT', 3001),
  databaseUrl: requireEnv('DATABASE_URL', 'file:./dev.db'),
  devBypass: envBool('DEV_BYPASS', false) && nodeEnv !== 'production',
  devBypassEmail: process.env.DEV_BYPASS_EMAIL ?? 'dev@localhost',
  bdadn: {
    server: process.env.BDADN_SERVER ?? '',
    database: process.env.BDADN_DATABASE ?? '',
    user: process.env.BDADN_USER ?? '',
    password: process.env.BDADN_PASSWORD ?? '',
    encrypt: envBool('BDADN_ENCRYPT', true),
    trustServerCertificate: envBool('BDADN_TRUST_SERVER_CERTIFICATE', false),
    poolMin: envInt('BDADN_POOL_MIN', 1),
    poolMax: envInt('BDADN_POOL_MAX', 10),
    connectTimeoutMs: envInt('BDADN_CONNECT_TIMEOUT_MS', 10_000),
    requestTimeoutMs: envInt('BDADN_REQUEST_TIMEOUT_MS', 30_000),
  },
  azureAd: {
    tenantId: process.env.AZURE_AD_TENANT_ID ?? '',
    clientId: process.env.AZURE_AD_CLIENT_ID ?? '',
    audience: process.env.AZURE_AD_AUDIENCE ?? '',
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

/**
 * Validaciones que solo aplican en produccion. Llamar al boot del server
 * para fallar/avisar fuerte si algo critico esta mal.
 */
export function assertProductionConfig(): void {
  if (!config.isProduction) return;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Auth: tenant + audience son obligatorios en prod (sin DEV_BYPASS)
  if (!config.azureAd.tenantId) errors.push('AZURE_AD_TENANT_ID es obligatorio en produccion');
  if (!config.azureAd.audience) errors.push('AZURE_AD_AUDIENCE es obligatorio en produccion');

  // DEV_BYPASS no debe estar activo en prod (config.devBypass ya lo bloquea, pero avisamos)
  if (process.env.DEV_BYPASS === 'true') {
    warnings.push('DEV_BYPASS=true esta seteado en produccion (sera ignorado por seguridad)');
  }

  // CORS: nada de wildcard ni localhost
  for (const origin of config.corsOrigins) {
    if (origin === '*') errors.push(`CORS_ORIGINS contiene wildcard "*"`);
    if (origin.includes('localhost')) {
      warnings.push(`CORS_ORIGINS contiene localhost ("${origin}") — verifica si es intencional`);
    }
    if (!origin.startsWith('https://')) {
      warnings.push(`CORS_ORIGINS "${origin}" no usa https — verifica si es intencional`);
    }
  }

  // BDADN: si no hay credenciales, los SPs van a fallar
  if (!config.bdadn.user || !config.bdadn.password) {
    errors.push('BDADN_USER/BDADN_PASSWORD son obligatorios');
  }

  for (const w of warnings) console.warn(`[config] WARN: ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`[config] FATAL: ${e}`);
    throw new Error(`Configuracion de produccion invalida (${errors.length} error(es))`);
  }
}
