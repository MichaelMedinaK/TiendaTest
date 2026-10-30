'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { ProductInInventoryError, ProductInUseError, ProductNotFoundError, SkuAlreadyRegisteredError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { optionalText, requireText } from '@/lib/validation';

const CATALOG_ROUTE = '/admin/catalogo';
const CATALOG_VIEWS = [CATALOG_ROUTE, '/admin/inventario', '/admin/ventas', '/admin/dashboard', '/admin/entregas', '/admin/reporte'];

export interface CatalogProduct {
  id: string;
  name: string;
  sku: string | null;
  inventoriesCount: number;
  salesCount: number;
}

export interface CatalogProductInput {
  name: string;
  sku?: string;
}

const CATALOG_SELECT = {
  id: true,
  name: true,
  sku: true,
  _count: { select: { inventoryItems: true, orderItems: true } },
} satisfies Prisma.ProductSelect;

function toCatalogProduct(product: Prisma.ProductGetPayload<{ select: typeof CATALOG_SELECT }>): CatalogProduct {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    inventoriesCount: product._count.inventoryItems,
    salesCount: product._count.orderItems,
  };
}

/** El SKU es unico: un duplicado se informa con un mensaje claro en lugar de un error tecnico. */
function rethrowDuplicatedSku(error: unknown, sku: string | null): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && sku) {
    throw new SkuAlreadyRegisteredError(sku);
  }

  throw error;
}

function revalidateCatalogViews(): void {
  for (const route of CATALOG_VIEWS) {
    revalidatePath(route);
  }
}

/** Catalogo general de productos (solo ADMIN). Cada vendedor agrega a su inventario los que vende. */
export async function getCatalog(): Promise<ActionResult<CatalogProduct[]>> {
  return executeAction('catalog.getCatalog', async (trace) => {
    await requireRole('ADMIN');

    const products = await prisma.product.findMany({ orderBy: { name: 'asc' }, select: CATALOG_SELECT });
    trace.addStep(`catalogo-listado:${products.length}`);

    return products.map(toCatalogProduct);
  });
}

export async function createCatalogProduct(input: CatalogProductInput): Promise<ActionResult<CatalogProduct>> {
  return executeAction('catalog.createProduct', async (trace) => {
    await requireRole('ADMIN');

    const name = requireText(input.name, 'nombre');
    const sku = optionalText(input.sku, 50);

    const product = await prisma.product
      .create({ data: { name, sku }, select: CATALOG_SELECT })
      .catch((error) => rethrowDuplicatedSku(error, sku));
    trace.setBusinessId(product.id);

    revalidateCatalogViews();
    return toCatalogProduct(product);
  });
}

export async function updateCatalogProduct(
  productId: string,
  input: CatalogProductInput,
): Promise<ActionResult<CatalogProduct>> {
  return executeAction('catalog.updateProduct', async (trace) => {
    await requireRole('ADMIN');
    trace.setBusinessId(productId);

    const name = requireText(input.name, 'nombre');
    const sku = optionalText(input.sku, 50);

    const existing = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });

    if (!existing) {
      throw new ProductNotFoundError(productId);
    }

    const product = await prisma.product
      .update({ where: { id: productId }, data: { name, sku }, select: CATALOG_SELECT })
      .catch((error) => rethrowDuplicatedSku(error, sku));

    revalidateCatalogViews();
    return toCatalogProduct(product);
  });
}

/** Elimina un producto que no esta en ningun inventario ni en ventas, para no romper el historial. */
export async function deleteCatalogProduct(productId: string): Promise<ActionResult<void>> {
  return executeAction('catalog.deleteProduct', async (trace) => {
    await requireRole('ADMIN');
    trace.setBusinessId(productId);

    const product = await prisma.product.findUnique({ where: { id: productId }, select: CATALOG_SELECT });

    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    if (product._count.orderItems > 0) {
      throw new ProductInUseError(product.name, product._count.orderItems);
    }

    if (product._count.inventoryItems > 0) {
      throw new ProductInInventoryError(product.name, product._count.inventoryItems);
    }

    await prisma.product.delete({ where: { id: productId } });
    trace.addStep('producto-eliminado');

    revalidateCatalogViews();
  });
}
