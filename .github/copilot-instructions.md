# Instrucciones para agentes de IA — TiendaTest

Punto de venta e inventario para una tienda pequeña. Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + Prisma 5 sobre PostgreSQL (Supabase en producción).

## ⚠️ Regla crítica: la base de datos es PRODUCCIÓN

El `.env` local apunta **directamente a Supabase en producción**. No hay base de desarrollo separada: cualquier comando de base de datos tiene efecto real e inmediato sobre la tienda.

**Nunca ejecutes comandos contra la base de producción.** Esto incluye `prisma db push`, `db:seed`, `db:rls`, `db:copy-products`, consultas con `PrismaClient` y cualquier script que abra una conexión usando `DATABASE_URL`, `DIRECT_URL` o `TARGET_DATABASE_URL`.

En su lugar: entrega al usuario el bloque de comandos exacto, explica qué va a cambiar y deja que él los ejecute.

Sí puedes ejecutar libremente contra bases **locales o temporales** (por ejemplo, creando un esquema de prueba aparte y eliminándolo al terminar).

## Comandos

| Comando | Para qué | ¿Puede ejecutarlo el agente? |
| --- | --- | --- |
| `npm run typecheck` | Verificación de tipos — **la validación por defecto** | ✅ Sí |
| `npm run dev` / `npm run build` | Servidor de desarrollo / build | ✅ Sí |
| `npm run db:push` | Sincroniza `schema.prisma` con la base | ❌ No — la ejecuta el usuario |
| `npm run db:rls` | Activa RLS y blinda la base en Supabase | ❌ No — la ejecuta el usuario |
| `npm run db:inventory-model` | Prepara el catálogo general + inventario por usuario (copia stock/precios a `inventory_items`); va **antes** de `db:push --accept-data-loss` | ❌ No — la ejecuta el usuario |
| `npm run db:post-push` | Registra el stock migrado como movimiento inicial y crea el cobro de las ventas ya pagadas; va **después** de `db:push` | ❌ No — la ejecuta el usuario |
| `npm run db:seed` | Crea el admin inicial desde las variables `SEED_ADMIN_*` | ❌ No — la ejecuta el usuario |
| `npm run db:copy-products` | Copia el catálogo entre dos bases | ❌ No — la ejecuta el usuario |

`npm run lint` queda esperando una configuración interactiva de ESLint (pendiente en el repo). **No lo uses para validar**: usa `npm run typecheck`.

## Base de datos

- **No hay migraciones versionadas.** El flujo es `prisma db push`; no existe `prisma/migrations/` y no debe introducirse `prisma migrate dev` sin acordarlo: con el esquema creado por `db push`, Prisma detecta drift y ofrece **resetear la base**.
- **Después de cada `db push` que cree tablas, hay que ejecutar `npm run db:rls`.** [prisma/enable-rls.sql](../prisma/enable-rls.sql) activa RLS sin políticas y le quita permisos a los roles `anon` y `authenticated` de Supabase, de modo que la API pública no puede leer ni escribir nada. La aplicación no se ve afectada porque se conecta como `postgres`.
- En Supabase se usa el **pooler de sesión (puerto 5432)** para `db push`; el de transacciones (6543) no sirve para DDL.
- Modelos: `User`, `Product`, `InventoryItem`, `InventoryMovement`, `Order`, `OrderItem`, `Payment` (mapeados a `users`, `products`, `inventory_items`, `inventory_movements`, `orders`, `order_items`, `payments`). Roles: `ADMIN`, `STAFF`, `RESELLER`, `COURIER`.
- **Cobros**: una venta se cobra con uno o varios `Payment` (importe, método, quién lo recibió). `Order.paymentStatus` (Pendiente, Parcial, Pagado) se calcula con `refreshPaymentStatus` de [src/lib/payments.ts](../src/lib/payments.ts); nunca se edita a mano. Un cobro no se borra: se anula con motivo.
- **Catálogo + inventario por usuario**: `Product` es el catálogo general (nombre y SKU, lo administra el ADMIN). Cada usuario tiene `InventoryItem` por producto con su `stock`, `costPrice` (precio real) y `price` (venta). El stock solo cambia por `InventoryMovement` (entrada, salida, venta, devolución) con motivo obligatorio, vía `applyStockChange` de [src/lib/inventory-movements.ts](../src/lib/inventory-movements.ts). Cada `Order` tiene un `sellerId` y `OrderItem.unitCost` guarda el costo al vender; un pedido cancelado devuelve su stock. El alcance por rol se resuelve en [src/lib/inventory-scope.ts](../src/lib/inventory-scope.ts).
- Usa siempre la instancia compartida de [src/lib/prisma.ts](../src/lib/prisma.ts); no instancies `PrismaClient` en código de la aplicación.

## Convenciones de código

- **Server Actions**: toda acción vive en `src/actions/` y se envuelve en `executeAction()` de [src/lib/action-runner.ts](../src/lib/action-runner.ts), que centraliza la traza y el mapeo de errores. Devuelven siempre `ActionResult<T>` (`{ success: true, data }` o `{ success: false, error }`), nunca lanzan hacia el cliente.
- **Errores de negocio**: lanza las subclases de `BusinessError` de [src/lib/errors.ts](../src/lib/errors.ts); su mensaje llega al usuario. Cualquier otra excepción se convierte en un mensaje técnico genérico.
- **Autorización**: el acceso por rol se decide en [src/lib/permissions.ts](../src/lib/permissions.ts) y lo aplica [src/middleware.ts](../src/middleware.ts) en el borde. Las Server Actions revalidan con `requireSession()` / `requireRole()` de [src/lib/session.ts](../src/lib/session.ts), porque el JWT puede estar desactualizado.
- **Sesión**: JWT propio firmado con `jose` (`AUTH_SECRET`) en cookie httpOnly; contraseñas con `bcryptjs`. No hay NextAuth.
- **Idioma**: la interfaz, los mensajes y la documentación van en español. Los comentarios y literales del código se escriben **sin tildes ni eñes** (`demostracion`, `duenio`); la documentación en Markdown sí las usa.
- **Rutas**: en español bajo `/admin` (`ventas`, `inventario`, `entregas`, `reporte`, `usuarios`, `cuenta`, `dashboard`).
- Comenta solo lo que necesita aclaración (el porqué, no el qué).

## Variables de entorno

Están documentadas en [docs/CONFIGURACION.md](../docs/CONFIGURACION.md); `.env.example` es la plantilla. `.env` nunca se versiona.

- La aplicación en ejecución usa `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_TOKEN_TTL_HOURS` y las `NEXT_PUBLIC_*`.
- `SEED_*` solo las lee `npm run db:seed`; `SOURCE_DATABASE_URL` / `TARGET_DATABASE_URL` solo `npm run db:copy-products`. Ninguna de esas se configura en el hosting.
- Nunca pongas secretos en variables `NEXT_PUBLIC_*`: llegan al navegador.
