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
