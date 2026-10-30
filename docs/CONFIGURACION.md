# Configuración por variables de entorno

Todas las variables se definen en el archivo `.env` de la raíz del proyecto. Usa [`.env.example`](../.env.example) como plantilla:

```bash
cp .env.example .env
```

`.env` está en `.gitignore` y **nunca** debe subirse al repositorio.

---

## Variables disponibles

### Base de datos

| Variable       | Obligatoria | Por defecto | Descripción                      |
| -------------- | :---------: | ----------- | -------------------------------- |
| `DATABASE_URL` |     Sí      | —           | Cadena de conexión a PostgreSQL  |

```env
DATABASE_URL="postgresql://usuario:clave@localhost:5432/tienda_test?schema=public"
```

### Sesión y seguridad

| Variable               | Obligatoria | Por defecto | Descripción                                             |
| ---------------------- | :---------: | ----------- | ------------------------------------------------------- |
| `AUTH_SECRET`          |     Sí      | —           | Clave de firma del JWT. Mínimo 32 caracteres aleatorios |
| `AUTH_TOKEN_TTL_HOURS` |     No      | `8`         | Horas de vigencia de la sesión                          |

Para generar un secreto seguro:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Si `AUTH_SECRET` falta, la aplicación falla al iniciar sesión de forma deliberada: es preferible a firmar tokens con una clave débil.

### Administrador maestro inicial (seed)

Estas variables **solo** las lee `npm run db:seed`. La aplicación en ejecución no las usa.

| Variable              | Obligatoria | Por defecto               | Descripción                                                  |
| --------------------- | :---------: | ------------------------- | ------------------------------------------------------------ |
| `SEED_ADMIN_EMAIL`    | Sí          | —                         | Correo del administrador maestro inicial                    |
| `SEED_ADMIN_PASSWORD` | Sí          | —                         | Clave inicial de al menos 12 caracteres (se guarda con bcrypt) |
| `SEED_ADMIN_NAME`     | No          | `Administrador Principal` | Nombre visible del administrador                            |
| `SEED_DEMO_PRODUCTS`  | No          | `true`                    | `false` para no crear productos de ejemplo                   |

Configura el correo y la clave en `.env` antes de ejecutar el seed. Sin ambos valores válidos, el seed falla en lugar de crear una cuenta con credenciales conocidas.

**Cómo funciona el seed:**

- Si el correo de `SEED_ADMIN_EMAIL` **no existe**, crea el usuario con rol `ADMIN` y la clave encriptada.
- Si **ya existe**, no hace nada: no duplica el usuario ni le cambia la clave.
- El administrador puede crear usuarios `ADMIN` o `STAFF`, activar/desactivar sus cuentas y restablecer sus claves desde **Usuarios**.
- Por eso, modificar `SEED_ADMIN_PASSWORD` después del primer seed **no** cambia la clave de un usuario ya creado. Para cambiarla usa la pantalla **Mi cuenta** o el reseteo desde **Usuarios** (ver [MANUAL-DE-USO.md](./MANUAL-DE-USO.md)).
- Para crear un administrador adicional (por ejemplo, si perdiste el acceso), pon un correo distinto en `SEED_ADMIN_EMAIL` y vuelve a ejecutar `npm run db:seed`.

### Copiar el catálogo de productos a otra base (local → producción)

Estas variables **solo** las lee `npm run db:copy-products`. La aplicación en ejecución no las usa.

| Variable              | Obligatoria | Descripción                                            |
| --------------------- | :---------: | ------------------------------------------------------ |
| `SOURCE_DATABASE_URL` |     Sí      | Base de **origen** (de donde se leen los productos)    |
| `TARGET_DATABASE_URL` |     Sí      | Base de **destino** (donde se escriben los productos)  |

```bash
npm run db:copy-products -- --dry-run   # muestra qué haría, sin escribir nada
npm run db:copy-products                # ejecuta la copia
```

**Cómo funciona:**

- Copia **solo la tabla `products`**. No toca usuarios, pedidos ni ningún otro dato del destino.
- **Nunca borra ni desactiva nada** en el destino: solo crea lo que falta y actualiza lo que ya existe.
- Empareja cada producto por `sku`; si el producto no tiene `sku`, lo busca por `id` y luego por nombre. Por eso se puede ejecutar varias veces sin duplicar el catálogo.
- Conserva el `id` y la fecha de creación originales de cada producto.
- Antes de escribir, deja una copia de respaldo en `prisma/products-export.json` (ignorado por Git).

### Presentación

Estas variables llevan el prefijo `NEXT_PUBLIC_` porque también se usan en el navegador; **no pongas secretos en ellas**.

| Variable                      | Obligatoria | Por defecto     | Descripción                               |
| ----------------------------- | :---------: | --------------- | ----------------------------------------- |
| `NEXT_PUBLIC_STORE_TIME_ZONE` |     No      | `America/Lima`  | Zona horaria para mostrar fechas          |
| `NEXT_PUBLIC_CURRENCY_SYMBOL` |     No      | `S/`            | Símbolo de moneda en la interfaz          |

Ejemplos de zona horaria: `America/Lima`, `America/Bogota`, `America/Mexico_City`, `Europe/Madrid`, `America/Argentina/Buenos_Aires`.

> La zona horaria se fija explícitamente para que el servidor y el navegador muestren siempre la misma fecha.

### Cotización del delivery

El precio se calcula como kilómetros × `NEXT_PUBLIC_DELIVERY_RATE_PER_KM`, redondeado hacia arriba a la unidad (4.7 km × 1.7 = 7.99 → 8). Los kilómetros se obtienen por carretera entre un punto fijo (la tienda) y la dirección escrita, usando OpenStreetMap (Nominatim para ubicar la dirección y OSRM para la ruta), sin clave de API. Estas variables solo las lee el servidor.

| Variable                  | Obligatoria | Descripción                                                                                   |
| ------------------------- | :---------: | --------------------------------------------------------------------------------------------- |
| `STORE_ORIGIN_LAT`        |     Sí      | Latitud del punto de salida. En Google Maps: clic derecho sobre la tienda y copia las coordenadas |
| `STORE_ORIGIN_LNG`        |     Sí      | Longitud del punto de salida                                                                  |
| `STORE_ORIGIN_LABEL`      |     No      | Nombre que se muestra como origen (por defecto `la tienda`)                                   |
| `GEOCODING_COUNTRY_CODES` |     No      | Limita la búsqueda a países, códigos ISO separados por coma (ej. `pe`)                        |

---

## Ejemplo completo

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tienda_test?schema=public"

AUTH_SECRET="pega-aqui-una-cadena-aleatoria-de-al-menos-32-caracteres"
AUTH_TOKEN_TTL_HOURS="8"

SEED_ADMIN_EMAIL="dueno@mitienda.com"
SEED_ADMIN_PASSWORD="UnaClaveMaestraLargaYUnica"
SEED_ADMIN_NAME="Dueno de la tienda"
SEED_DEMO_PRODUCTS="false"

NEXT_PUBLIC_STORE_TIME_ZONE="America/Lima"
NEXT_PUBLIC_CURRENCY_SYMBOL="S/"
```

---

## Preguntas frecuentes

**¿Dónde quedan guardados los usuarios y sus claves?**
En la base de datos PostgreSQL, tabla `users`. Las claves se almacenan **encriptadas con bcrypt**, nunca en texto plano ni en variables de entorno. Las variables `SEED_ADMIN_*` solo definen el usuario inicial; una vez creado, la fuente de verdad es la base de datos.

**¿Cada persona que quiera probar la tienda necesita su propia instalación?**
Sí: cada instalación apunta a su propia `DATABASE_URL`, con sus propios usuarios, productos y ventas. Dos tiendas de prueba independientes no comparten datos.

**¿Qué pasa si cambio `AUTH_SECRET` con la aplicación en marcha?**
Todas las sesiones abiertas dejan de ser válidas y los usuarios deben volver a iniciar sesión. Es la forma de invalidar sesiones si sospechas que el secreto se filtró.

**¿Tengo que reiniciar tras editar `.env`?**
Sí, reinicia el servidor (`npm run dev`) para que lea los valores nuevos.
