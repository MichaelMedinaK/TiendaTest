-- Datos iniciales del modelo nuevo. Ejecutalo UNA vez DESPUES de "npm run db:push".
--
-- Que hace:
--   1) Registra como entrada "Stock inicial" el stock con el que quedo cada producto al migrar al inventario por
--      usuario, para que el historial y el stock sean coherentes desde el principio.
--   2) Crea un cobro por el total de cada venta que ya estaba marcada como pagada, para que el control de cobros
--      parta con esas ventas al dia.
-- Es idempotente: solo afecta lo que todavia no tiene movimientos ni cobros.
--
-- Como ejecutarlo:  npm run db:post-push

INSERT INTO inventory_movements ("id", "inventoryItemId", "type", "quantity", "stockAfter", "reason", "userId", "createdAt")
SELECT
  gen_random_uuid()::text,
  i."id",
  'ENTRY'::"MovementType",
  i."stock",
  i."stock",
  'Stock inicial (migracion al nuevo inventario)',
  i."ownerId",
  now()
FROM inventory_items i
WHERE i."stock" > 0
  AND NOT EXISTS (SELECT 1 FROM inventory_movements m WHERE m."inventoryItemId" = i."id");

INSERT INTO payments ("id", "orderId", "amount", "method", "receivedById", "note", "createdAt")
SELECT
  gen_random_uuid()::text,
  o."id",
  o."total",
  o."paymentMethod",
  o."sellerId",
  'Pago registrado antes del control de cobros',
  now()
FROM orders o
WHERE o."paymentStatus" = 'PAID'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p."orderId" = o."id");
