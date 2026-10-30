-- Preparacion del catalogo general + inventario por usuario. Ejecutalo UNA vez ANTES de "npm run db:push".
--
-- Que hace:
--   1) Asigna las ventas existentes al administrador mas antiguo (columna orders.sellerId).
--   2) Crea la tabla inventory_items y copia a ella el stock, costo y precio de venta de cada producto actual
--      (asignados al administrador mas antiguo). Los productos actuales pasan a ser el catalogo general.
-- Despues, "db push --accept-data-loss" elimina de products las columnas viejas (stock, price, costPrice, ownerId);
-- no se pierde nada porque ya quedaron copiadas en inventory_items.
-- Es idempotente: se puede ejecutar varias veces, y no hace nada si el modelo nuevo ya esta aplicado.
--
-- Como ejecutarlo:  npm run db:inventory-model   (o pegarlo en el SQL Editor de Supabase)

DO $$
DECLARE
  admin_id text;
  cost_expr text;
BEGIN
  SELECT id INTO admin_id FROM users WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1;

  ALTER TABLE orders ADD COLUMN IF NOT EXISTS "sellerId" TEXT;
  UPDATE orders SET "sellerId" = admin_id WHERE "sellerId" IS NULL;

  -- Solo si products todavia tiene las columnas del modelo anterior.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'stock'
  ) THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
    UPDATE products SET "ownerId" = admin_id WHERE "ownerId" IS NULL;

    CREATE TABLE IF NOT EXISTS inventory_items (
      "id" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "stock" INTEGER NOT NULL DEFAULT 0,
      "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "price" DOUBLE PRECISION NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_ownerId_productId_key" ON inventory_items ("ownerId", "productId");
    CREATE INDEX IF NOT EXISTS "inventory_items_productId_idx" ON inventory_items ("productId");

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_ownerId_fkey') THEN
      ALTER TABLE inventory_items ADD CONSTRAINT "inventory_items_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES users ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_productId_fkey') THEN
      ALTER TABLE inventory_items ADD CONSTRAINT "inventory_items_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES products ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- costPrice solo existe si ya se aplico el modelo de precio real.
    cost_expr := CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'costPrice'
      ) THEN 'p."costPrice"'
      ELSE '0'
    END;

    EXECUTE format(
      'INSERT INTO inventory_items ("id", "ownerId", "productId", "stock", "costPrice", "price", "createdAt")
       SELECT gen_random_uuid()::text, p."ownerId", p."id", p."stock", %s, p."price", p."createdAt"
       FROM products p
       WHERE p."ownerId" IS NOT NULL
       ON CONFLICT ("ownerId", "productId") DO NOTHING',
      cost_expr
    );
  END IF;
END $$;
