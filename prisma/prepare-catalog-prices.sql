-- Precios en el catalogo. Ejecutalo UNA vez ANTES de "npm run db:push -- --accept-data-loss".
--
-- Que hace:
--   Agrega products.costPrice y products.price y los llena con los precios que hoy tiene cada producto en los
--   inventarios. Si el producto esta en varios inventarios con precios distintos, se usa el del administrador
--   (y si no esta en el suyo, el del inventario mas antiguo).
-- Despues, "db push --accept-data-loss" elimina inventory_items.costPrice e inventory_items.price; no se pierde
-- nada porque ya quedaron copiados en el catalogo.
-- Es idempotente: solo llena los productos que todavia tienen precio 0, y no hace nada si ya se aplico.
--
-- Como ejecutarlo:  npm run db:catalog-prices   (o pegarlo en el SQL Editor de Supabase)

DO $$
BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION NOT NULL DEFAULT 0;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'price'
  ) THEN
    UPDATE products p
    SET "costPrice" = s."costPrice", "price" = s."price"
    FROM (
      SELECT DISTINCT ON (i."productId") i."productId", i."costPrice", i."price"
      FROM inventory_items i
      JOIN users u ON u."id" = i."ownerId"
      ORDER BY i."productId", (u."role" = 'ADMIN') DESC, i."createdAt" ASC
    ) s
    WHERE p."id" = s."productId" AND p."price" = 0;
  END IF;
END $$;
