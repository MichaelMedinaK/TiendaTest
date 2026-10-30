# Tienda Test

MVP fullstack para gestionar ventas, entregas (delivery), métodos de pago e inventario de una tienda.

## Stack

- Next.js 14 (App Router + Server Actions)
- TypeScript
- Prisma ORM sobre PostgreSQL
- Tailwind CSS
- `bcryptjs` + `jose` (JWT en cookie HTTP-Only `auth_token`)
- `lucide-react` para iconos

## Documentación

- [Manual de uso](./docs/MANUAL-DE-USO.md) — cómo entrar, crear usuarios, cambiar claves y operar ventas, entregas e inventario.
- [Configuración](./docs/CONFIGURACION.md) — todas las variables de entorno explicadas.

## Puesta en marcha

```bash
npm install
cp .env.example .env          # ajusta DATABASE_URL, AUTH_SECRET y SEED_ADMIN_*
npm run db:push               # crea las tablas
npm run db:rls                # protege la base (RLS) si usas Supabase
npm run db:seed
npm run dev
```

La aplicación queda disponible en http://localhost:3000. Define `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` en `.env` antes de ejecutar el seed; la contraseña debe tener al menos 12 caracteres.

### Base de datos con Docker (opcional)

```bash
docker run -d --name tienda-test-db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tienda_test \
  -p 5432:5432 postgres:16-alpine
```

### Credenciales iniciales

El administrador maestro inicial lo crea `npm run db:seed` a partir de variables de entorno:

```env
SEED_ADMIN_EMAIL="dueno@mitienda.com"
SEED_ADMIN_PASSWORD="UnaClaveMaestraLargaYUnica"
SEED_ADMIN_NAME="Administrador Principal"
```

> Define estos valores **antes** del primer seed. No hay credenciales predeterminadas. Una vez creado el usuario, la fuente de verdad es la base de datos: cambiar `SEED_ADMIN_PASSWORD` ya no afecta a la clave. En **Usuarios**, el administrador puede crear usuarios ADMIN o STAFF, activar/desactivar sus cuentas y restablecer sus claves.

## Variables de entorno

| Variable                        | Descripción                                             |
| ------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`                  | Cadena de conexión a PostgreSQL                         |
| `AUTH_SECRET`                   | Clave de firma del JWT (mínimo 32 caracteres)           |
| `AUTH_TOKEN_TTL_HOURS`          | Vigencia de la cookie de sesión (por defecto 8)         |
| `SEED_ADMIN_EMAIL`              | Correo del administrador inicial                        |
| `SEED_ADMIN_PASSWORD`           | Clave inicial del administrador (se guarda encriptada)  |
| `SEED_ADMIN_NAME`               | Nombre visible del administrador inicial                |
| `SEED_DEMO_PRODUCTS`            | `false` para no crear productos de ejemplo              |
| `NEXT_PUBLIC_STORE_TIME_ZONE`   | Zona horaria para formatear fechas                      |
| `NEXT_PUBLIC_CURRENCY_SYMBOL`   | Símbolo de moneda mostrado en la interfaz               |

Detalle completo en [docs/CONFIGURACION.md](./docs/CONFIGURACION.md).

## Estructura

```
docs/
  MANUAL-DE-USO.md       Guía de uso del panel
  CONFIGURACION.md       Variables de entorno explicadas
prisma/
  schema.prisma          Modelos User, Product, Order, OrderItem y enums
  seed.ts                Crea el admin inicial (desde SEED_ADMIN_*) y productos demo
src/
  actions/               Server Actions (auth, users, products, orders, dashboard)
  app/
    login/               Inicio de sesión
    admin/dashboard/     Métricas rápidas
    admin/ventas/        Registro, edición y eliminación de ventas; estados de pago y envío
    admin/inventario/    Alta de productos y edición de stock
    admin/reporte/       Reporte del estado de la tienda, imprimible a PDF
    admin/usuarios/      Gestión de usuarios y reseteo de claves (solo ADMIN)
    admin/cuenta/        Datos del usuario y cambio de clave propia
  components/            Componentes reutilizables y estilos compartidos
  lib/                   Prisma, sesión/JWT, validación, errores, logging y formato
  middleware.ts          Guarda de acceso a /admin
```

## Decisiones de diseño

- **Contrato único de acciones**: toda Server Action se ejecuta dentro de `executeAction`, que traduce las excepciones de negocio a `{ success: false, error }` y nunca filtra detalles técnicos al cliente.
- **Un solo log por petición**: `ActionTrace` acumula los pasos en memoria y emite un único log JSON (`trace_id`, `business_id`, `uri`, `duration_ms`, `status`, `steps`) al terminar, en lugar de dispersar `console.log` por el flujo.
- **Integridad de stock**: la venta se registra en una transacción y el descuento usa `updateMany` filtrando por `stock >= cantidad`, lo que evita sobreventa ante peticiones simultáneas. Eliminar o editar una venta devuelve/reajusta las unidades en el inventario.
- **Precios de confianza**: el total se calcula con el precio del catálogo, nunca con el que envía el navegador.
- **Sesión verificada**: el layout se pinta con el JWT, pero cada acción revalida el usuario en base de datos para que una desactivación tenga efecto inmediato.
- **Gestión de claves**: el admin puede resetear la clave de cualquier usuario sin conocer la anterior; el cambio de clave propia exige la contraseña actual para que una sesión robada no pueda apropiarse de la cuenta.

## Scripts

| Script                     | Descripción                                    |
| -------------------------- | ---------------------------------------------- |
| `npm run dev`              | Servidor de desarrollo                         |
| `npm run build`            | `prisma generate` + build de producción        |
| `npm run start`            | Servidor de producción                         |
| `npm run typecheck`        | Verificación de tipos                          |
| `npm run lint`             | ESLint                                         |
| `npm run db:push`          | Sincroniza el esquema con la base de datos     |
| `npm run db:rls`           | Activa RLS y blinda la base (Supabase)         |
| `npm run db:inventory-model` | Prepara el catalogo general + inventario por usuario (antes de `db:push`) |
| `npm run db:post-push` | Datos iniciales del modelo nuevo: stock inicial y cobros de ventas ya pagadas (después de `db:push`) |
| `npm run db:seed`          | Ejecuta el seed                                |
| `npm run db:copy-products` | Copia el catálogo de productos entre dos bases |
