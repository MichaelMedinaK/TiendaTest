/**
 * Excepciones de negocio de la aplicacion. Permiten diferenciar un error
 * esperado (mostrable al usuario) de un fallo tecnico inesperado.
 */
export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCredentialsError extends BusinessError {
  constructor() {
    super('Correo o contrasena incorrectos');
  }
}

export class InactiveUserError extends BusinessError {
  constructor() {
    super('El usuario esta desactivado. Contacta al administrador');
  }
}

export class IncorrectCurrentPasswordError extends BusinessError {
  constructor() {
    super('La contrasena actual no es correcta');
  }
}

export class UnauthorizedError extends BusinessError {
  constructor(message = 'Sesion no valida o expirada') {
    super(message);
  }
}

export class ForbiddenError extends BusinessError {
  constructor(message = 'No tienes permisos para realizar esta accion') {
    super(message);
  }
}

export class ValidationError extends BusinessError {}

export class EmailAlreadyRegisteredError extends BusinessError {
  constructor(email: string) {
    super(`El correo ${email} ya esta registrado`);
  }
}

export class UserNotFoundError extends BusinessError {
  constructor(userId: string) {
    super(`No se encontro el usuario ${userId}`);
  }
}

export class ProductNotFoundError extends BusinessError {
  constructor(productId: string) {
    super(`No se encontro el producto ${productId}`);
  }
}

export class OrderNotFoundError extends BusinessError {
  constructor(orderId: string) {
    super(`No se encontro la venta ${orderId}`);
  }
}

export class InsufficientStockError extends BusinessError {
  constructor(productName: string, available: number) {
    super(`Stock insuficiente para "${productName}". Disponible: ${available}`);
  }
}
