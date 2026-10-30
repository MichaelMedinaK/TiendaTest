// Copia el catalogo de productos de una base a otra (por ejemplo: local -> produccion).
//
// Nunca borra ni desactiva nada en el destino: solo crea los productos que faltan y actualiza
// los que ya existen. Se puede ejecutar varias veces (es idempotente).
//
// Configuracion: agrega estas dos variables a tu archivo .env (no se versiona)
//   SOURCE_DATABASE_URL="postgresql://usuario:clave@localhost:5432/tienda_test?schema=public"
//   TARGET_DATABASE_URL="postgresql://postgres:clave@db.xxxx.supabase.co:5432/postgres"
//
// Uso:
//   npm run db:copy-products -- --dry-run   (solo muestra que haria, no escribe)
//   npm run db:copy-products                (ejecuta la copia)

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PrismaClient, type Product } from '@prisma/client';

const ENV_FILE = resolve(process.cwd(), '.env');
const BACKUP_FILE = resolve(process.cwd(), 'prisma/products-export.json');
const IS_DRY_RUN = process.argv.includes('--dry-run');

/** Carga el .env sin pisar las variables que ya vengan del entorno real. */
function loadEnvFile(): void {
  let contents: string;

  try {
    contents = readFileSync(ENV_FILE, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])([\s\S]*)\1$/, '$2');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireDatabaseUrl(name: 'SOURCE_DATABASE_URL' | 'TARGET_DATABASE_URL'): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Falta la variable ${name}. Agregala a tu archivo .env antes de copiar.`);
  }

  return value;
}

function createClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

/** Oculta la clave para poder mostrar a que base apunta cada conexion. */
function describeConnection(url: string): string {
  try {
    const parsed = new URL(url);
    const schema = parsed.searchParams.get('schema');

    return `${parsed.host}${parsed.pathname}${schema ? `?schema=${schema}` : ''}`;
  } catch {
    return '(cadena de conexion invalida)';
  }
}

/** Busca el producto equivalente en el destino: por SKU si lo tiene, si no por id y luego por nombre. */
async function findExistingProduct(target: PrismaClient, product: Product): Promise<Product | null> {
  if (product.sku) {
    return target.product.findUnique({ where: { sku: product.sku } });
  }

  const byId = await target.product.findUnique({ where: { id: product.id } });

  if (byId) {
    return byId;
  }

  return target.product.findFirst({ where: { name: product.name, sku: null } });
}

async function main(): Promise<void> {
  loadEnvFile();

  const sourceUrl = requireDatabaseUrl('SOURCE_DATABASE_URL');
  const targetUrl = requireDatabaseUrl('TARGET_DATABASE_URL');

  if (sourceUrl === targetUrl) {
    throw new Error('SOURCE_DATABASE_URL y TARGET_DATABASE_URL apuntan a la misma base.');
  }

  const source = createClient(sourceUrl);
  const target = createClient(targetUrl);

  console.log(`[copy-products] Origen:  ${describeConnection(sourceUrl)}`);
  console.log(`[copy-products] Destino: ${describeConnection(targetUrl)}`);

  if (IS_DRY_RUN) {
    console.log('[copy-products] Modo --dry-run: no se escribira nada en el destino');
  }

  try {
    const products = await source.product.findMany({ orderBy: { createdAt: 'asc' } });

    if (products.length === 0) {
      console.log('[copy-products] El origen no tiene productos, no hay nada que copiar');
      return;
    }

    writeFileSync(BACKUP_FILE, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
    console.log(`[copy-products] ${products.length} productos leidos del origen (respaldo en ${BACKUP_FILE})`);

    let created = 0;
    let updated = 0;

    for (const product of products) {
      const existing = await findExistingProduct(target, product);
      const data = {
        name: product.name,
        sku: product.sku,
        price: product.price,
        stock: product.stock,
        isActive: product.isActive,
      };

      if (existing) {
        if (!IS_DRY_RUN) {
          await target.product.update({ where: { id: existing.id }, data });
        }

        updated += 1;
        console.log(`[copy-products] Actualiza: ${product.sku ?? '(sin sku)'} - ${product.name}`);
        continue;
      }

      if (!IS_DRY_RUN) {
        await target.product.create({ data: { ...data, id: product.id, createdAt: product.createdAt } });
      }

      created += 1;
      console.log(`[copy-products] Crea:      ${product.sku ?? '(sin sku)'} - ${product.name}`);
    }

    const prefix = IS_DRY_RUN ? 'Simulacion' : 'Listo';
    console.log(`[copy-products] ${prefix}: ${created} creados, ${updated} actualizados, 0 eliminados`);
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error('[copy-products] Error copiando los productos');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
