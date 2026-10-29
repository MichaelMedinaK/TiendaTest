'use server';

import type { Product } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { ProductNotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import {
  optionalText,
  requireNonNegativeInteger,
  requirePositiveNumber,
  requireText,
} from '@/lib/validation';

const INVENTORY_ROUTE = '/admin/inventario';
const SALES_ROUTE = '/admin/ventas';

export interface CreateProductInput {
  name: string;
  price: number;
  stock: number;
  sku?: string;
}

export async function getProducts(): Promise<ActionResult<Product[]>> {
  return executeAction('products.getProducts', async (trace) => {
    await requireSession();

    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    trace.addStep(`productos-listados:${products.length}`);

    return products;
  });
}

export async function createProduct(input: CreateProductInput): Promise<ActionResult<Product>> {
  return executeAction('products.createProduct', async (trace) => {
    await requireSession();

    const name = requireText(input.name, 'nombre');
    const price = requirePositiveNumber(input.price, 'precio');
    const stock = requireNonNegativeInteger(input.stock, 'stock');
    const sku = optionalText(input.sku, 50);
    trace.addStep('datos-validados');

    const createdProduct = await prisma.product.create({ data: { name, price, stock, sku } });
    trace.setBusinessId(createdProduct.id);
    trace.addStep('producto-creado');

    revalidatePath(INVENTORY_ROUTE);
    revalidatePath(SALES_ROUTE);

    return createdProduct;
  });
}

export async function updateStock(productId: string, newStock: number): Promise<ActionResult<Product>> {
  return executeAction('products.updateStock', async (trace) => {
    await requireSession();
    trace.setBusinessId(productId);

    const stock = requireNonNegativeInteger(newStock, 'stock');
    const existingProduct = await prisma.product.findUnique({ where: { id: productId } });

    if (!existingProduct) {
      throw new ProductNotFoundError(productId);
    }

    const updatedProduct = await prisma.product.update({ where: { id: productId }, data: { stock } });
    trace.addStep(`stock-actualizado:${existingProduct.stock}->${stock}`);

    revalidatePath(INVENTORY_ROUTE);
    revalidatePath(SALES_ROUTE);

    return updatedProduct;
  });
}
