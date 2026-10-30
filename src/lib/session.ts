import 'server-only';

import { cookies } from 'next/headers';

import type { Role } from '@prisma/client';

import { ForbiddenError, InactiveUserError, UnauthorizedError } from './errors';
import {
  AUTH_COOKIE_NAME,
  SessionPayload,
  getTokenTtlSeconds,
  signSessionToken,
  verifySessionToken,
} from './jwt';
import { prisma } from './prisma';

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const cookieStore = await cookies();

  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: getTokenTtlSeconds(),
  });
}

export async function destroySessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

/** Sesion ligera basada solo en el JWT. Suficiente para pintar el layout. */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Sesion verificada contra la base de datos. La usan las Server Actions para que
 * desactivar o cambiar el rol de un usuario surta efecto sin esperar a que expire el JWT.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getCurrentSession();

  if (!session) {
    throw new UnauthorizedError();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isActive: true, role: true },
  });

  if (!user) {
    throw new UnauthorizedError();
  }

  if (!user.isActive) {
    throw new InactiveUserError();
  }

  return { ...session, role: user.role };
}

/** Exige una sesion valida cuyo rol (leido de la base de datos) este entre los permitidos. */
export async function requireRole(...allowedRoles: Role[]): Promise<SessionPayload> {
  const session = await requireSession();

  if (!allowedRoles.includes(session.role)) {
    throw new ForbiddenError();
  }

  return session;
}

export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await requireSession();

  if (session.role !== 'ADMIN') {
    throw new ForbiddenError('Solo un administrador puede gestionar usuarios');
  }

  return session;
}
