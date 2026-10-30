'use server';

import { redirect } from 'next/navigation';

import type { Role } from '@prisma/client';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { IS_PRODUCTION, LOGIN_ROUTE } from '@/lib/constants';
import {
  IncorrectPasswordError,
  InactiveUserError,
  InvalidCredentialsError,
  UserDoesNotExistError,
} from '@/lib/errors';
import { toLoginInfrastructureError } from '@/lib/login-errors';
import { DUMMY_PASSWORD_HASH, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { createSessionCookie, destroySessionCookie } from '@/lib/session';
import { requireUsername, requireText } from '@/lib/validation';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

async function findUserOrExplain(email: string) {
  try {
    return await prisma.user.findUnique({ where: { email } });
  } catch (error) {
    throw toLoginInfrastructureError(error);
  }
}

/**
 * En produccion siempre el mismo mensaje, para no revelar si el usuario existe. En desarrollo se detalla
 * si falla el usuario o la clave, para facilitar las pruebas.
 */
function invalidCredentialsError(userExists: boolean, username: string): Error {
  if (IS_PRODUCTION) {
    return new InvalidCredentialsError();
  }

  return userExists ? new IncorrectPasswordError() : new UserDoesNotExistError(username);
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

    const user = await findUserOrExplain(normalizedEmail);

    // Siempre se compara una clave (con un hash falso si el usuario no existe) para igualar los tiempos de respuesta.
    const isPasswordValid = await verifyPassword(plainPassword, user?.password ?? DUMMY_PASSWORD_HASH);

    if (!user || !isPasswordValid) {
      throw invalidCredentialsError(user !== null, normalizedEmail);
    }

    // El estado "desactivado" solo se revela a quien ya demostro conocer la clave.
    if (!user.isActive) {
      throw new InactiveUserError();
    }

    trace.addStep('password-verificado');

    try {
      await createSessionCookie({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } catch (error) {
      throw toLoginInfrastructureError(error);
    }

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
  await destroySessionCookie();
  redirect(LOGIN_ROUTE);
}
