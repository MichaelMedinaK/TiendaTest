import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Hash de una clave que nadie conoce. Se compara cuando el usuario no existe para que el login tarde lo mismo
 * que con un usuario real y no se pueda deducir, por el tiempo de respuesta, que usuarios existen.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync('clave-inexistente-sin-uso', SALT_ROUNDS);
