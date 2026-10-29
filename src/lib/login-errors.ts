import { Prisma } from '@prisma/client';

import { ServiceUnavailableError } from './errors';

const DB_UNREACHABLE = 'No se pudo conectar con la base de datos. Verifica que el servidor de base de datos este encendido y accesible, e intentalo nuevamente';

const INITIALIZATION_MESSAGES: Record<string, string> = {
  P1000: 'La base de datos rechazo el usuario o la clave configurados en DATABASE_URL. Revisa las credenciales de conexion',
  P1001: DB_UNREACHABLE,
  P1002: 'La base de datos no respondio a tiempo. Verifica que el servidor este encendido y la red disponible',
  P1003: 'La base de datos configurada en DATABASE_URL no existe. Crea la base o corrige el nombre',
  P1008: 'La operacion con la base de datos supero el tiempo de espera. Intentalo nuevamente',
  P1011: 'No se pudo establecer la conexion segura (SSL/TLS) con la base de datos. Revisa la configuracion de DATABASE_URL',
  P1017: 'La base de datos cerro la conexion inesperadamente. Intentalo nuevamente',
};

const REQUEST_MESSAGES: Record<string, string> = {
  P1001: DB_UNREACHABLE,
  P1002: INITIALIZATION_MESSAGES.P1002,
  P1008: INITIALIZATION_MESSAGES.P1008,
  P1017: INITIALIZATION_MESSAGES.P1017,
  P2021: 'Falta una tabla en la base de datos. Ejecuta las migraciones de Prisma (prisma migrate deploy)',
  P2022: 'Falta una columna en la base de datos. Ejecuta las migraciones de Prisma (prisma migrate deploy)',
  P2024: 'La base de datos esta saturada (sin conexiones disponibles). Intentalo en unos segundos',
};

/**
 * Traduce un fallo tecnico durante el inicio de sesion a un error con mensaje claro.
 * Devuelve el error original si no se reconoce, para que se registre como tecnico.
 */
export function toLoginInfrastructureError(error: unknown): unknown {
  if (error instanceof ServiceUnavailableError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    const message = (error.errorCode && INITIALIZATION_MESSAGES[error.errorCode]) || DB_UNREACHABLE;
    return new ServiceUnavailableError(message);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const message = REQUEST_MESSAGES[error.code];
    return message ? new ServiceUnavailableError(message) : error;
  }

  if (error instanceof Prisma.PrismaClientRustPanicError || error instanceof Prisma.PrismaClientUnknownRequestError) {
    return new ServiceUnavailableError('La base de datos fallo al procesar la consulta. Revisa los logs del servidor');
  }

  if (error instanceof Error && error.message.includes('AUTH_SECRET')) {
    return new ServiceUnavailableError('El servidor no tiene configurada la clave de sesiones (AUTH_SECRET). Contacta al administrador');
  }

  return error;
}
