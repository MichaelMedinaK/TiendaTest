# Manual de uso — Tienda Test

Guía para el administrador de una tienda de prueba: cómo entrar, crear usuarios, cambiar claves y operar ventas, entregas e inventario.

> ¿Buscas cómo instalar el proyecto? Está en el [README](../README.md).
> ¿Buscas la lista completa de variables de entorno? Está en [CONFIGURACION.md](./CONFIGURACION.md).

---

## 1. El primer acceso

La aplicación no tiene registro público: **el primer administrador se crea con el comando de seed**, y sus credenciales salen de variables de entorno.

En el archivo `.env`:

```env
SEED_ADMIN_EMAIL="admin@tiendatest.com"
SEED_ADMIN_PASSWORD="admin123"
SEED_ADMIN_NAME="Administrador Principal"
```

Luego se ejecuta una sola vez:

```bash
npm run db:seed
```

Eso crea el usuario administrador con la clave **encriptada** (nunca se guarda en texto plano).

Con la aplicación iniciada (`npm run dev`), entra a http://localhost:3000, escribe ese correo y esa clave, y pulsa **Ingresar**.

### Puntos importantes

- El seed es **idempotente**: si el correo ya existe, no lo vuelve a crear ni cambia su clave. Cambiar `SEED_ADMIN_PASSWORD` después del primer seed **no** modifica la clave del usuario que ya existe; para eso usa la pantalla **Mi cuenta** (sección 3).
- Si pones otro correo en `SEED_ADMIN_EMAIL` y vuelves a ejecutar el seed, se crea un **segundo** administrador; el anterior sigue existiendo.
- La sesión se guarda en una cookie `auth_token` (HTTP-Only, no accesible desde JavaScript) y dura lo que indique `AUTH_TOKEN_TTL_HOURS` (8 horas por defecto). Al vencer, vuelve a pedir el inicio de sesión.

---

## 2. Qué ve cada rol

| Sección         | ADMIN | STAFF |
| --------------- | :---: | :---: |
| Dashboard       |  Sí   |  Sí   |
| Ventas          |  Sí   |  Sí   |
| Inventario      |  Sí   |  Sí   |
| Reporte         |  Sí   |  Sí   |
| Usuarios        |  Sí   |  No   |
| Mi cuenta       |  Sí   |  Sí   |

Un usuario **STAFF** no ve el enlace **Usuarios** y, si entra por URL directa, recibe el mensaje *"Solo un administrador puede gestionar usuarios"*. El permiso se valida en el servidor, no solo escondiendo el enlace.

---

## 3. Mi cuenta — cambiar tu propia clave

Disponible para cualquier rol, en **Mi cuenta**.

1. Escribe tu **clave actual**.
2. Escribe la **clave nueva** (mínimo 6 caracteres) y confírmala.
3. Pulsa **Actualizar clave**.

Se exige la clave actual a propósito: si alguien se quedara con tu sesión abierta, no podría apropiarse de la cuenta.

Si la clave actual es incorrecta verás *"La contrasena actual no es correcta"*.

---

## 4. Usuarios (solo ADMIN)

### Crear un usuario

En **Usuarios → Crear usuario**:

1. **Nombre** (opcional) y **Correo** (obligatorio y único).
2. **Contraseña** inicial, mínimo 6 caracteres.
3. **Rol**: `Administrador` o `Staff`.
4. Pulsa **Crear usuario**.

La clave se encripta con bcrypt antes de guardarse. Entrégasela a la persona y pídele que la cambie desde **Mi cuenta**.

Si el correo ya está en uso verás *"El correo X ya esta registrado"*.

### Cambiar la clave de otro usuario

Útil cuando alguien olvidó su clave: no necesitas conocer la anterior.

1. En la tabla de usuarios, busca la fila de la persona.
2. En la columna **Clave**, pulsa **Cambiar clave**.
3. Escribe la clave nueva y pulsa **Guardar**.

### Activar o desactivar un usuario

En la columna **Acceso**, el botón **Desactivar** / **Activar** corta o restituye el acceso sin borrar el historial de la persona.

- El efecto es **inmediato**: un usuario desactivado que tenga la sesión abierta recibe *"El usuario esta desactivado. Contacta al administrador"* en su siguiente acción.
- No puedes desactivarte a ti mismo: así la tienda nunca se queda sin administrador.

---

## 5. Inventario

### Agregar un producto

En **Inventario → Agregar producto**: nombre, SKU (opcional, único), precio y stock inicial. El precio debe ser mayor que cero y el stock un entero mayor o igual a cero.

### Ajustar el stock

En la tabla, escribe la nueva cantidad en la columna **Actualizar stock** y pulsa **Guardar**. El botón solo se habilita si cambiaste el valor.

Esto **reemplaza** la cantidad, no la suma: si el producto tiene 10 y escribes 25, queda en 25.

Los productos con 5 unidades o menos se marcan como **(bajo)** y se cuentan en la métrica *Stock bajo* del dashboard.

---

## 6. Ventas

### Registrar una venta

En **Ventas → Registrar nueva venta**:

1. **Descripción** (obligatoria), **Referencia** y **Dirección** (opcionales; solo la parte necesaria, por ejemplo el distrito; sin dirección la venta aparece como *Retiro en tienda*).
2. **Método de pago**: Efectivo o Transferencia.
3. **Estado del pago**: Pendiente de pago o Pagado.
4. **Estado del envío**: Pendiente, En tránsito, Entregado o Devuelto.
5. Elige el **producto** del stock y la **cantidad**. Con **Agregar producto** sumas más líneas a la misma venta.
6. Revisa el **Total estimado** y pulsa **Registrar venta**.

Al guardarse, el stock de cada producto se descuenta automáticamente.

**Sobre los precios:** el total se calcula con el precio que tiene el producto en el catálogo en ese momento, y queda congelado en la venta. Cambiar el precio después no altera las ventas ya registradas.

**Si no hay stock suficiente** verás, por ejemplo, *"Stock insuficiente para "Gorra Deportiva". Disponible: 4"* y la venta **no** se registra: o se guarda completa, o no se guarda nada.

### Editar una venta

En la fila de la venta pulsa **Editar**, cambia cualquier dato o los productos y pulsa **Guardar cambios**. El stock se reajusta solo: primero se devuelven las unidades que tenía la venta y luego se descuentan las nuevas. Si no alcanza el stock, la edición se rechaza y la venta queda como estaba.

### Eliminar una venta

En la fila de la venta pulsa **Eliminar** y confirma. La venta se borra y sus unidades vuelven al inventario.

### Cambiar el estado del pago

La columna **Pago** muestra el método y un desplegable que guarda al instante: *Pendiente de pago* o *Pagado*.

### Cambiar el estado del envío

La columna **Envío** tiene un desplegable que guarda al instante:

| Estado      | Significado                       |
| ----------- | --------------------------------- |
| Pendiente   | Aún no despachado                 |
| En transito | En camino                         |
| Entregado   | Recibido por el cliente           |
| Devuelto    | El cliente lo devolvió            |

Este estado **no** mueve el inventario: si una devolución debe volver al stock, elimina la venta o ajusta la cantidad en Inventario.

Si un cambio falla, el desplegable vuelve solo a su valor anterior y muestra el motivo: lo que ves siempre refleja lo que está guardado.

---

## 7. Reporte en PDF

En **Reporte** se resume el estado de la tienda: ventas registradas, total vendido, cobrado y por cobrar, estado de pagos y envíos, stock actual (con los productos de stock bajo) y el listado de pedidos.

Pulsa **Imprimir / Guardar PDF** y, en el diálogo de impresión del navegador, elige **Guardar como PDF** como destino.

---

## 8. Dashboard

| Métrica           | Qué cuenta                                                        |
| ----------------- | ----------------------------------------------------------------- |
| Ventas totales    | Suma de los totales de todas las ventas                           |
| Pagos pendientes  | Ventas con el pago en estado Pendiente                            |
| Envíos pendientes | Ventas con envío Pendiente o En tránsito                          |
| Stock bajo        | Productos activos con 5 unidades o menos                          |

Se recalculan en cada visita a la página.

---

## 9. Cerrar sesión

El botón **Cerrar sesión**, abajo en el menú lateral, borra la cookie y te devuelve al inicio de sesión. Recomendado en equipos compartidos.

---

## 9. Problemas frecuentes

| Situación | Causa y solución |
| --------- | ---------------- |
| *"Correo o contrasena incorrectos"* | Credenciales mal escritas, o el correo no existe. Si olvidaste la clave, pide a otro admin que te la cambie (sección 4). |
| *"El usuario esta desactivado"* | Un admin desactivó la cuenta. Pide que la reactiven. |
| La app te devuelve al login sola | La sesión venció (`AUTH_TOKEN_TTL_HOURS`). Vuelve a entrar. |
| *"Solo un administrador puede gestionar usuarios"* | Tu rol es STAFF; pide a un admin que haga el cambio o que te suba de rol. |
| *"Stock insuficiente para X"* | Vendes más unidades de las disponibles. Ajusta la cantidad o repone stock en Inventario. |
| No puedes desactivarte a ti mismo | Es intencional, para no dejar la tienda sin administrador. Usa otra cuenta admin. |
| Nadie puede entrar y no hay admin disponible | Ejecuta `npm run db:seed` con un `SEED_ADMIN_EMAIL` nuevo en `.env`: crea otro administrador sin tocar los datos existentes. |

---

## 10. Recomendaciones de seguridad

- Cambia `SEED_ADMIN_PASSWORD` **antes** del primer seed, y vuelve a cambiar la clave desde **Mi cuenta** tras el primer acceso.
- `AUTH_SECRET` debe ser una cadena larga y aleatoria (mínimo 32 caracteres). Si se filtra, cualquiera podría falsificar sesiones.
- El archivo `.env` **no** se versiona (está en `.gitignore`). Comparte únicamente `.env.example`.
- Da rol **Staff** por defecto; reserva **Administrador** para quien realmente gestione usuarios.
- Desactiva las cuentas que dejen de usarse en lugar de compartir credenciales.
