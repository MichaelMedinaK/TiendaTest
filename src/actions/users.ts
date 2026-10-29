'use server';

import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import {
  EmailAlreadyRegisteredError,
  ForbiddenError,
  IncorrectCurrentPasswordError,
  UserNotFoundError,
} from '@/lib/errors';
import { hashPassword, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { requireAdminSession, requireSession } from '@/lib/session';
import {
  optionalText,
  requireEmail,
  requireEnumValue,
  requirePassword,
  requireText,
} from '@/lib/validation';

const USERS_ROUTE = '/admin/usuarios';

/** Proyeccion publica: nunca expone el hash de la contrasena a la capa de presentacion. */
export interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateUserInput {
  name?: string;
  email: string;
  password: string;
  role: Role;
}

export async function getUsers(): Promise<ActionResult<UserSummary[]>> {
  return executeAction('users.getUsers', async (trace) => {
    await requireAdminSession();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    trace.addStep(`usuarios-listados:${users.length}`);
    return users;
  });
}

export async function createUser(input: CreateUserInput): Promise<ActionResult<UserSummary>> {
  return executeAction('users.createUser', async (trace) => {
    await requireAdminSession();

    const email = requireEmail(input.email);
    const password = requirePassword(input.password);
    const role = requireEnumValue(input.role, Role, 'rol');
    const name = optionalText(input.name);
    trace.setBusinessId(email);
    trace.addStep('datos-validados');

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new EmailAlreadyRegisteredError(email);
    }

    const createdUser = await prisma.user.create({
      data: { email, name, role, password: await hashPassword(password) },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    trace.setBusinessId(createdUser.id);
    trace.addStep('usuario-creado');

    revalidatePath(USERS_ROUTE);
    return createdUser;
  });
}

export async function toggleUserStatus(userId: string, isActive: boolean): Promise<ActionResult<UserSummary>> {
  return executeAction('users.toggleUserStatus', async (trace) => {
    const session = await requireAdminSession();
    trace.setBusinessId(userId);

    // Regla de negocio: un administrador no puede bloquearse a si mismo y dejar la tienda sin acceso.
    if (session.userId === userId && !isActive) {
      throw new ForbiddenError('No puedes desactivar tu propio usuario');
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!targetUser) {
      throw new UserNotFoundError(userId);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    trace.addStep(`estado-actualizado:${isActive ? 'ACTIVO' : 'INACTIVO'}`);

    revalidatePath(USERS_ROUTE);
    return updatedUser;
  });
}

/**
 * Reseteo administrativo: el ADMIN asigna una clave nueva sin conocer la anterior.
 * Pensado para recuperar el acceso de un usuario que la olvido.
 */
export async function resetUserPassword(userId: string, newPassword: string): Promise<ActionResult<UserSummary>> {
  return executeAction('users.resetUserPassword', async (trace) => {
    await requireAdminSession();
    trace.setBusinessId(userId);

    const password = requirePassword(newPassword);
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!targetUser) {
      throw new UserNotFoundError(userId);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { password: await hashPassword(password) },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    trace.addStep('clave-reseteada-por-admin');

    revalidatePath(USERS_ROUTE);
    return updatedUser;
  });
}

/**
 * Cambio de clave propia. Exige la contrasena actual para que una sesion robada
 * no pueda apropiarse de la cuenta. Disponible para cualquier rol.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult<void>> {
  return executeAction('users.changeOwnPassword', async (trace) => {
    const session = await requireSession();
    trace.setBusinessId(session.userId);

    const typedCurrentPassword = requireText(currentPassword, 'contrasena actual');
    const password = requirePassword(newPassword);

    const user = await prisma.user.findUnique({ where: { id: session.userId } });

    if (!user) {
      throw new UserNotFoundError(session.userId);
    }

    const isCurrentPasswordValid = await verifyPassword(typedCurrentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw new IncorrectCurrentPasswordError();
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { password: await hashPassword(password) },
    });

    trace.addStep('clave-propia-actualizada');
  });
}
