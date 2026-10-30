import { PrismaClient, Role } from '@prisma/client';

import { hashPassword } from '../src/lib/password';
import { requireUsername, requirePassword } from '../src/lib/validation';

const prisma = new PrismaClient();

const SHOULD_SEED_DEMO_PRODUCTS = (process.env.SEED_DEMO_PRODUCTS ?? 'true').toLowerCase() !== 'false';

const DEMO_PRODUCTS = [
  { name: 'Camiseta Basica', sku: 'CAM-001', costPrice: 7, price: 12.5, stock: 40 },
  { name: 'Pantalon Jean', sku: 'PAN-002', costPrice: 18, price: 29.9, stock: 15 },
  { name: 'Gorra Deportiva', sku: 'GOR-003', costPrice: 4, price: 8.0, stock: 4 },
] as const;

async function seedDefaultAdmin(): Promise<void> {
  const email = requireUsername(process.env.SEED_ADMIN_EMAIL);
  const password = requirePassword(process.env.SEED_ADMIN_PASSWORD, 12);
  const name = process.env.SEED_ADMIN_NAME?.trim() || 'Administrador Principal';
  const existingAdmin = await prisma.user.findUnique({ where: { email } });

  if (existingAdmin) {
    console.log(`[seed] El usuario admin ya existe: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name,
      password: await hashPassword(password),
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log(`[seed] Usuario admin creado: ${email}`);
}

async function seedDemoProducts(): Promise<void> {
  if (!SHOULD_SEED_DEMO_PRODUCTS) {
    console.log('[seed] SEED_DEMO_PRODUCTS=false, se omiten los productos de demostracion');
    return;
  }

  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN }, orderBy: { createdAt: 'asc' } });

  if (!admin) {
    console.log('[seed] No hay administrador, se omiten los productos de demostracion');
    return;
  }

  const productCount = await prisma.product.count();

  if (productCount > 0) {
    console.log('[seed] Catalogo existente, no se insertan productos de demostracion');
    return;
  }

  for (const { stock, costPrice, price, ...product } of DEMO_PRODUCTS) {
    const created = await prisma.product.create({ data: product });
    const item = await prisma.inventoryItem.create({
      data: { ownerId: admin.id, productId: created.id, costPrice, price, stock },
    });

    await prisma.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: 'ENTRY',
        quantity: stock,
        stockAfter: stock,
        reason: 'Stock inicial de demostracion',
        userId: admin.id,
      },
    });
  }

  console.log(`[seed] ${DEMO_PRODUCTS.length} productos de demostracion creados`);
}

async function main(): Promise<void> {
  await seedDefaultAdmin();
  await seedDemoProducts();
}

main()
  .catch((error) => {
    console.error('[seed] Error ejecutando el seed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
