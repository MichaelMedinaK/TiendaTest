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

| Sección         | ADMIN | TENDERO / REVENDEDOR | DOMICILIARIO |
| --------------- | :---: | :------------------: | :----------: |
| Dashboard       |  Sí   |          Sí          |      No      |
| Ventas          |  Sí   |          Sí          |      No      |
| Entregas        |  Sí   |          Sí          |      Sí      |
| Cotizar envío   |  Sí   |          Sí          |      No      |
| Inventario      |  Sí   |          Sí          |      No      |
| Catálogo        |  Sí   |          No          |      No      |
| Reporte         |  Sí   |          Sí          |      No      |
| Usuarios        |  Sí   |          No          |      No      |
| Mi cuenta       |  Sí   |          Sí          |      Sí      |

- **Administrador:** gestiona todo: usuarios, todos los inventarios, ventas y reportes.
- **Tendero** y **Revendedor:** cada uno tiene su propio stock, precios, ventas y reporte. No ven lo de los demás.
- **Domiciliario:** solo ve **Entregas**. Allí cambia el **método de pago** y el **estado del pedido**, y registra los **cobros** de cualquier domicilio abierto.
- **Perfil de domiciliario adicional:** un tendero o revendedor puede ser también domiciliario (el admin lo marca al crear el usuario o con **Hacer domiciliario** en la tabla). Conserva su inventario y además atiende todos los domicilios en Entregas. Sin ese perfil, en Entregas solo ve los de sus propias ventas.

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

En **Usuarios**, pulsa **+ Nuevo usuario** para desplegar el formulario:

1. **Nombre** (opcional) y **Correo** (obligatorio y único).
2. **Contraseña** inicial, mínimo 6 caracteres.
3. **Rol**: `Administrador`, `Tendero`, `Revendedor` o `Domiciliario`. Para tenderos y revendedores puedes marcar **También es domiciliario**.
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

## 5. Catálogo e inventario

Los productos son **generales**: el administrador los crea una sola vez en el **Catálogo** (nombre y SKU) y cada vendedor los **agrega a su propio inventario**, con su **precio real** (lo que le cuesta, lo escribe él), su **precio de venta** y su stock. El mismo producto puede tener precios y cantidades distintos en cada inventario.

### Catálogo (solo ADMIN)

En **Catálogo**, **+ Nuevo producto** crea el producto para todos. Se puede editar nombre y SKU. Solo se puede eliminar si no está en ningún inventario ni en ventas.

### Ver el inventario de otro usuario (ADMIN)

En **Inventario**, el selector **Inventario de** cambia entre usuarios. Todo lo que hagas debajo se aplica al inventario elegido. Un tendero o revendedor no ve el selector: siempre trabaja con el suyo.

### Agregar un producto al inventario

Pulsa **+ Agregar al inventario**, elige el producto del catálogo y escribe precio real, precio de venta y stock inicial. Si pones stock inicial, la descripción es obligatoria (por defecto "Stock inicial") y queda como la primera entrada del historial.

### La lista

Cada producto se ve en una línea con su nombre y **precio de venta**. Toca la línea para desplegar el resto: precio real, margen, stock y las acciones **Entrada**, **Salida**, **Editar precios** e **Historial**.

### Modificar el stock: entradas y salidas

El stock **no se edita directamente**. Solo cambia con:
- **Entrada:** suma unidades (por ejemplo, mercancía recibida).
- **Salida:** resta unidades (por ejemplo, mercancía entregada a otra persona). No puede dejar el stock en negativo.
- **Ventas:** descuentan solas al registrarse y devuelven al cancelar o eliminar la venta.

Cada entrada y salida exige una **descripción** y queda en el **Historial** con el usuario, la fecha y el stock resultante. Los inventarios de distintos vendedores no se sincronizan: si Juan entrega 5 a Pedro, Juan registra una salida y Pedro registra su propia entrada.

Los productos con 5 unidades o menos se marcan como **(bajo)**.

### Editar precios

**Editar precios** cambia el precio real y el precio de venta. La lista muestra el **margen** (venta − real). Al cambiar el precio de venta, las ventas aún pendientes de ese vendedor que tenían el precio anterior se recalculan; las ya cerradas no cambian. El precio real que ya quedó registrado en ventas anteriores tampoco cambia.

---

## 6. Ventas

### Registrar una venta

En **Ventas**, pulsa **+ Nueva venta** para desplegar el formulario:

1. **Descripción** (obligatoria), **Referencia** y **Dirección** (opcionales; solo la parte necesaria, por ejemplo el distrito; sin dirección la venta aparece como *Retiro en tienda*).
2. **Método de pago**: Efectivo o Transferencia (el método previsto; cada cobro registra el suyo).
3. **Pago recibido**: déjalo en *Pendiente de pago*, o márcalo como *Ya pagado* para registrar el cobro por el total.
4. Elige el **producto** del stock y la **cantidad**. Con **Agregar producto** sumas más líneas a la misma venta.
5. Revisa el **Total estimado** y pulsa **Registrar venta**. El envío siempre parte como *Nuevo*.

Al guardarse, el stock de cada producto se descuenta automáticamente **del inventario del vendedor**.

**Vendedor:** por defecto vendes desde tu propio inventario. Si eres ADMIN y hay más de un usuario con inventario, el campo **Vender desde el inventario de** te deja elegir de quién descontar; los productos disponibles cambian según el vendedor. Una venta conserva su vendedor al editarla.

**Envío a domicilio:** escribe la dirección y pulsa **Calcular km desde la dirección** para llenar los kilómetros automáticamente (ver sección 7).

**Sobre los precios:** el total se calcula con el precio que tiene el producto en el catálogo en ese momento, y queda congelado en la venta. Cambiar el precio después no altera las ventas ya registradas.

**Si no hay stock suficiente** verás, por ejemplo, *"Stock insuficiente para "Gorra Deportiva". Disponible: 4"* y la venta **no** se registra: o se guarda completa, o no se guarda nada.

### Editar una venta

En la fila de la venta pulsa **Editar**, cambia cualquier dato o los productos y pulsa **Guardar cambios**. El stock se ajusta solo por la diferencia (se devuelve lo que ya no se vende y se descuenta lo nuevo) y queda en el historial. Si no alcanza el stock, la edición se rechaza y la venta queda como estaba.

### Eliminar una venta

En la fila de la venta pulsa **Eliminar** y confirma. La venta se borra y sus unidades vuelven al inventario.

### Cobros (pago total o parcial)

El estado del pago **no se edita a mano**: se calcula con los cobros registrados. Pulsa **Cobros** en una venta (en Ventas, Inicio o Entregas) para ver el detalle:

- Cada cobro guarda el **importe**, el **método** (efectivo o transferencia), **quién lo recibió** y la fecha. Una venta puede cobrarse en varios cobros, por ejemplo una parte en efectivo y otra por transferencia.
- El estado pasa solo a **Pago parcial** cuando se cobró menos del total y a **Pagado** cuando se completa. No se puede cobrar más que el saldo, ni en un pedido cancelado.
- Un cobro registrado por error se **anula** con un motivo obligatorio: queda en el historial tachado y deja de contar. Pueden registrar y anular cobros el vendedor de la venta, el administrador y los domiciliarios.
- Si editas una venta y cambia el total, el estado se recalcula con lo ya cobrado.

El reporte muestra **Cobrado** (suma de cobros) y **Por cobrar** (saldo de las ventas no canceladas).

### Cambiar el estado del envío

La columna **Envío** tiene un desplegable que guarda al instante:

| Estado      | Significado                       |
| ----------- | --------------------------------- |
| Nuevo       | Aún no despachado                 |
| Empacado    | Listo para salir                  |
| En camino   | En camino                         |
| Entregado   | Recibido por el cliente           |
| Cancelado   | El pedido se canceló              |

Al pasar un pedido a **Cancelado**, sus unidades **vuelven al stock** del vendedor (queda en el historial). Si lo reactivas, se vuelven a descontar; si ya no hay stock suficiente, el cambio se rechaza.

Si un cambio falla, el desplegable vuelve solo a su valor anterior y muestra el motivo: lo que ves siempre refleja lo que está guardado.

---

## 7. Cotizar envío

En **Cotizar envío** escribes una dirección y la app calcula los **kilómetros por carretera** desde el punto fijo de la tienda y el **precio del delivery** (km × tarifa por km, redondeado hacia arriba a la unidad: 4.7 km × 1.7 = 7.99 → 8). Incluye el distrito o la ciudad para que ubique bien la dirección; abajo se muestra la dirección encontrada para confirmar que es la correcta.

El mismo cálculo está disponible dentro del formulario de venta (botón **Calcular km desde la dirección**).

Requiere configurar el punto de salida y la tarifa: ver [CONFIGURACION.md](./CONFIGURACION.md#cotización-del-delivery).

---

## 8. Reporte en PDF

En **Reporte** se resume el estado de la tienda: ventas registradas, total vendido, cobrado y por cobrar, **costo de lo vendido y ganancia**, stock a precio real y a precio de venta, estado de pagos y envíos, stock actual (con los productos de stock bajo) y el listado de pedidos con la ganancia de cada uno.

- La **ganancia** es venta de productos − costo registrado al vender; no incluye el envío ni las ventas canceladas.
- El **ADMIN** puede filtrar por inventario con el selector **Reporte de** (por defecto, todos) y ve un **resumen por vendedor**. Un STAFF solo ve su propio reporte.

Pulsa **Imprimir / Guardar PDF** y, en el diálogo de impresión del navegador, elige **Guardar como PDF** como destino.

---

## 9. Dashboard

| Métrica           | Qué cuenta                                                        |
| ----------------- | ----------------------------------------------------------------- |
| Ventas totales    | Suma de los totales de todas las ventas                           |
| Pagos pendientes  | Ventas con el pago en estado Pendiente                            |
| Envíos pendientes | Ventas con envío Pendiente o En tránsito                          |
| Stock bajo        | Productos activos con 5 unidades o menos                          |

Se recalculan en cada visita a la página.

---

## 10. Cerrar sesión

El botón **Cerrar sesión**, abajo en el menú lateral, borra la cookie y te devuelve al inicio de sesión. Recomendado en equipos compartidos.

---

## 11. Problemas frecuentes

| Situación | Causa y solución |
| --------- | ---------------- |
| *"Correo o contrasena incorrectos"* | Credenciales mal escritas, o el correo no existe. Si olvidaste la clave, pide a otro admin que te la cambie (sección 4). |
| *"El usuario esta desactivado"* | Un admin desactivó la cuenta. Pide que la reactiven. |
| La app te devuelve al login sola | La sesión venció (`AUTH_TOKEN_TTL_HOURS`). Vuelve a entrar. |
| *"Solo un administrador puede gestionar usuarios"* | Tu rol es STAFF; pide a un admin que haga el cambio o que te suba de rol. |
| *"Stock insuficiente para X"* | Vendes más unidades de las disponibles. Ajusta la cantidad o repone stock en Inventario. |
| No puedes desactivarte a ti mismo | Es intencional, para no dejar la tienda sin administrador. Usa otra cuenta admin. |
| *"Falta configurar el punto de salida de la tienda"* | Define `STORE_ORIGIN_LAT` y `STORE_ORIGIN_LNG` en `.env` (ver [CONFIGURACION.md](./CONFIGURACION.md#cotización-del-delivery)). |
| *"No se encontro la direccion"* | Agrega barrio, ciudad o un punto de referencia a la dirección. |
| *"El producto X no pertenece al inventario de este vendedor"* | La venta mezcla productos de inventarios distintos; elige el vendedor correcto y sus productos. |
| Nadie puede entrar y no hay admin disponible | Ejecuta `npm run db:seed` con un `SEED_ADMIN_EMAIL` nuevo en `.env`: crea otro administrador sin tocar los datos existentes. |

---

## 12. Recomendaciones de seguridad

- Cambia `SEED_ADMIN_PASSWORD` **antes** del primer seed, y vuelve a cambiar la clave desde **Mi cuenta** tras el primer acceso.
- `AUTH_SECRET` debe ser una cadena larga y aleatoria (mínimo 32 caracteres). Si se filtra, cualquiera podría falsificar sesiones.
- El archivo `.env` **no** se versiona (está en `.gitignore`). Comparte únicamente `.env.example`.
- Da rol **Staff** por defecto; reserva **Administrador** para quien realmente gestione usuarios.
- Desactiva las cuentas que dejen de usarse en lugar de compartir credenciales.
