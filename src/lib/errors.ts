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
    super('Usuario o contrasena incorrectos');
  }
}

export class UserDoesNotExistError extends BusinessError {
  constructor(username: string) {
    super(`El usuario "${username}" no existe. Revisa que este bien escrito`);
  }
}

export class IncorrectPasswordError extends BusinessError {
  constructor() {
    super('La contrasena es incorrecta. Verifica mayusculas, minusculas y vuelve a intentarlo');
  }
}

/** Fallo de infraestructura con un mensaje accionable (base de datos, configuracion). */
export class ServiceUnavailableError extends BusinessError {}

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
  constructor(message = 'Tu sesion expiro o ya no es valida. Cierra sesion e ingresa de nuevo') {
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
    super(`El usuario ${email} ya esta registrado`);
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

export class SkuAlreadyRegisteredError extends BusinessError {
  constructor(sku: string) {
    super(`Ya existe un producto con el SKU "${sku}"`);
  }
}

export class ProductInUseError extends BusinessError {
  constructor(productName: string, salesCount: number) {
    super(
      `No se puede eliminar "${productName}" porque esta en ${salesCount} venta(s) registrada(s). ` +
        'Si ya no lo vendes, deja su stock en 0',
    );
  }
}

export class ProductInInventoryError extends BusinessError {
  constructor(productName: string, inventoriesCount: number) {
    super(`No se puede eliminar "${productName}" porque esta en ${inventoriesCount} inventario(s)`);
  }
}

export class ProductAlreadyInInventoryError extends BusinessError {
  constructor(productName: string) {
    super(`"${productName}" ya esta en este inventario. Registra una entrada para sumar stock`);
  }
}

export class InventoryItemNotFoundError extends BusinessError {
  constructor(itemId: string) {
    super(`No se encontro el producto ${itemId} en el inventario`);
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
