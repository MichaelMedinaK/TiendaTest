import { JWTPayload, SignJWT, jwtVerify } from 'jose';

// Import de solo tipos: el middleware corre en Edge Runtime y no puede cargar el cliente Prisma.
import type { Role } from '@prisma/client';

export const AUTH_COOKIE_NAME = 'auth_token';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
}

const JWT_ALGORITHM = 'HS256';
const DEFAULT_TTL_HOURS = 8;

function getSigningKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('La variable de entorno AUTH_SECRET no esta configurada');
  }

  return new TextEncoder().encode(secret);
}

export function getTokenTtlSeconds(): number {
  const configuredHours = Number(process.env.AUTH_TOKEN_TTL_HOURS);
  const ttlHours = Number.isFinite(configuredHours) && configuredHours > 0 ? configuredHours : DEFAULT_TTL_HOURS;

  return ttlHours * 60 * 60;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + getTokenTtlSeconds())
    .sign(getSigningKey());
}

/** Devuelve la sesion o null si el token es invalido/expirado. Compatible con el runtime Edge. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), { algorithms: [JWT_ALGORITHM] });
    return toSessionPayload(payload);
  } catch {
    return null;
  }
}

function toSessionPayload(payload: JWTPayload): SessionPayload | null {
  const { userId, email, name, role } = payload as Partial<SessionPayload>;

  if (typeof userId !== 'string' || typeof email !== 'string' || !role) {
    return null;
  }

  return { userId, email, name: name ?? null, role };
}
