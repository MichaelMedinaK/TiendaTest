'use server';

import { redirect } from 'next/navigation';

import type { Role } from '@prisma/client';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { LOGIN_ROUTE } from '@/lib/constants';
import { InactiveUserError, InvalidCredentialsError } from '@/lib/errors';
import { verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { createSessionCookie, destroySessionCookie } from '@/lib/session';
import { requireUsername, requireText } from '@/lib/validation';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

/**
 * Valida credenciales y emite la cookie HTTP-Only `auth_token`.
 * La redireccion se delega al cliente para no interferir con el manejo de errores.
 */
export async function login(email: string, password: string): Promise<ActionResult<AuthenticatedUser>> {
  return executeAction('auth.login', async (trace) => {
    const normalizedEmail = requireUsername(email);
    const plainPassword = requireText(password, 'contrasena');
    trace.setBusinessId(normalizedEmail);
    trace.addStep('credenciales-validadas');

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new InactiveUserError();
    }

    const isPasswordValid = await verifyPassword(plainPassword, user.password);

    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    trace.addStep('password-verificado');

    await createSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    trace.addStep('cookie-sesion-emitida');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    } satisfies AuthenticatedUser;
  });
}

export async function logout(): Promise<void> {
  destroySessionCookie();
  redirect(LOGIN_ROUTE);
}
