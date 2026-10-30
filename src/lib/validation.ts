import { ValidationError } from './errors';

export function requireText(value: unknown, fieldLabel: string, maxLength = 255): string {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!text) {
    throw new ValidationError(`El campo "${fieldLabel}" es obligatorio`);
  }

  if (text.length > maxLength) {
    throw new ValidationError(`El campo "${fieldLabel}" supera los ${maxLength} caracteres`);
  }

  return text;
}

export function optionalText(value: unknown, maxLength = 255): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, maxLength) : null;
}

/** Numero decimal >= 0 (km, precios). Devuelve null si viene vacio. */
export function optionalNonNegativeNumber(value: unknown, fieldLabel: string): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new ValidationError(`El campo "${fieldLabel}" debe ser un numero mayor o igual a cero`);
  }

  return parsedValue;
}

/** Fecha en formato AAAA-MM-DD (valor de <input type="date">). Devuelve null si viene vacia. */
export function optionalIsoDate(value: unknown, fieldLabel: string): Date | null {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!text) {
    return null;
  }

  const date = new Date(`${text}T00:00:00.000Z`);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new ValidationError(`El campo "${fieldLabel}" no es una fecha valida`);
  }

  return date;
}

/** Hora en formato HH:mm (valor de <input type="time">). Devuelve null si viene vacia. */
export function optionalTime(value: unknown, fieldLabel: string): string | null {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!text) {
    return null;
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw new ValidationError(`El campo "${fieldLabel}" no es una hora valida`);
  }

  return text;
}

/** Identificador de acceso: texto libre sin espacios (puede ser un correo, un alias, etc.). */
export function requireUsername(value: unknown): string {
  const username = requireText(value, 'usuario', 100).toLowerCase();

  if (/\s/.test(username)) {
    throw new ValidationError('El usuario no puede contener espacios');
  }

  if (username.length < 3) {
    throw new ValidationError('El usuario debe tener al menos 3 caracteres');
  }

  return username;
}

export function requirePassword(value: unknown, minLength = 6): string {
  const password = typeof value === 'string' ? value : '';

  if (password.length < minLength) {
    throw new ValidationError(`La contrasena debe tener al menos ${minLength} caracteres`);
  }

  return password;
}

export function requirePositiveNumber(value: unknown, fieldLabel: string): number {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new ValidationError(`El campo "${fieldLabel}" debe ser mayor que cero`);
  }

  return parsedValue;
}

export function requireNonNegativeInteger(value: unknown, fieldLabel: string): number {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new ValidationError(`El campo "${fieldLabel}" debe ser un entero mayor o igual a cero`);
  }

  return parsedValue;
}

export function requirePositiveInteger(value: unknown, fieldLabel: string): number {
  const parsedValue = requireNonNegativeInteger(value, fieldLabel);

  if (parsedValue === 0) {
    throw new ValidationError(`El campo "${fieldLabel}" debe ser mayor que cero`);
  }

  return parsedValue;
}

export function requireEnumValue<TEnum extends Record<string, string>>(
  value: unknown,
  enumObject: TEnum,
  fieldLabel: string,
): TEnum[keyof TEnum] {
  const allowedValues = Object.values(enumObject);

  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    throw new ValidationError(`El campo "${fieldLabel}" no tiene un valor valido`);
  }

  return value as TEnum[keyof TEnum];
}
