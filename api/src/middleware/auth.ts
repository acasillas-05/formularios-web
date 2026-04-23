import type { Usuario } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { config } from '../config.js';
import { prisma } from '../prisma.js';

/**
 * Error con HTTP status para que el errorHandler global lo mapee correctamente.
 */
class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

/**
 * JWKS remoto de Entra ID. Se inicializa lazy y se cachea entre requests
 * (jose usa cache-control interno; por default refresca cada 10 minutos).
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!config.azureAd.tenantId) {
    throw new AuthError(500, 'Entra ID no esta configurado (AZURE_AD_TENANT_ID ausente)');
  }
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${config.azureAd.tenantId}/discovery/v2.0/keys`),
    );
  }
  return jwks;
}

type TokenIdentity = {
  email: string;
  nombre: string;
};

async function verifyEntraToken(token: string): Promise<TokenIdentity> {
  if (!config.azureAd.audience) {
    throw new AuthError(500, 'Entra ID no esta configurado (AZURE_AD_AUDIENCE ausente)');
  }

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, getJwks(), {
      issuer: [
        `https://login.microsoftonline.com/${config.azureAd.tenantId}/v2.0`,
        `https://sts.windows.net/${config.azureAd.tenantId}/`,
      ],
      audience: config.azureAd.audience,
    });
    payload = verified.payload;
  } catch {
    throw new AuthError(401, 'Token invalido o expirado');
  }

  const email = (payload.upn ?? payload.preferred_username ?? payload.email) as string | undefined;
  if (!email) {
    throw new AuthError(401, 'El token no contiene un claim de email (upn/preferred_username/email)');
  }
  const nombre = (payload.name as string | undefined) ?? email;
  return { email: email.toLowerCase(), nombre };
}

async function findOrProvisionUser(identity: TokenIdentity, isBypass: boolean): Promise<Usuario> {
  const existing = await prisma.usuario.findUnique({ where: { email: identity.email } });
  if (existing) return existing;

  // Auto-provision: via Entra ID entra como "operativo" (el admin debe promover).
  // Bajo DEV_BYPASS entra como "administrador" (es el dev local).
  const rol = isBypass ? 'administrador' : 'operativo';
  const created = await prisma.usuario.create({
    data: {
      email: identity.email,
      nombre: identity.nombre,
      rol,
    },
  });
  console.log(`[auth] auto-provisioned ${identity.email} as ${rol}`);
  return created;
}

/**
 * Middleware principal de autenticacion.
 * Aplica tanto a rutas Entra ID reales como al modo DEV_BYPASS.
 * Tras ejecutar, req.user esta poblado con el usuario de la BD.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let identity: TokenIdentity;

    if (config.devBypass) {
      identity = {
        email: config.devBypassEmail.toLowerCase(),
        nombre: 'Dev Bypass',
      };
    } else {
      const header = req.header('authorization') ?? '';
      if (!header.startsWith('Bearer ')) {
        throw new AuthError(401, 'Falta header Authorization: Bearer <token>');
      }
      const token = header.slice('Bearer '.length).trim();
      if (!token) {
        throw new AuthError(401, 'Token vacio');
      }
      identity = await verifyEntraToken(token);
    }

    const user = await findOrProvisionUser(identity, config.devBypass);

    if (!user.activo || user.deleted_at) {
      throw new AuthError(403, 'Usuario inactivo');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ ok: false, error: err.message });
      return;
    }
    next(err);
  }
}

export { AuthError };
