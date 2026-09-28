BEGIN;
DO $$
DECLARE
  active_tenant_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO active_tenant_count
  FROM restaurant_tenants
  WHERE status = 'ACTIVE';

  IF active_tenant_count <> 1 THEN
    RAISE EXCEPTION
      'Customer tenant backfill requires exactly one ACTIVE restaurant; found %',
      active_tenant_count;
  END IF;

  IF EXISTS (
    SELECT co."customerId"
    FROM customer_orders co
    JOIN branches b ON b.id = co."branchId"
    GROUP BY co."customerId"
    HAVING COUNT(DISTINCT b."tenantId") > 1
  ) THEN
    RAISE EXCEPTION
      'Customer orders span multiple tenants; resolve identity ownership before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM customer_verification_challenges challenge
    JOIN customers customer ON customer.id = challenge."customerId"
    WHERE challenge.phone <> customer.phone
  ) THEN
    RAISE EXCEPTION
      'Customer verification challenge phone does not match its linked customer';
  END IF;
END $$;

ALTER TABLE customers ADD COLUMN "tenantId" TEXT;
UPDATE customers customer
SET "tenantId" = COALESCE(
  (
    SELECT MIN(branch."tenantId")
    FROM customer_orders customer_order
    JOIN branches branch ON branch.id = customer_order."branchId"
    WHERE customer_order."customerId" = customer.id
  ),
  (SELECT id FROM restaurant_tenants WHERE status = 'ACTIVE' LIMIT 1)
);
ALTER TABLE customers ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE customer_verification_challenges ADD COLUMN "tenantId" TEXT;
UPDATE customer_verification_challenges challenge
SET "tenantId" = COALESCE(
  (SELECT customer."tenantId" FROM customers customer WHERE customer.id = challenge."customerId"),
  (SELECT id FROM restaurant_tenants WHERE status = 'ACTIVE' LIMIT 1)
);
ALTER TABLE customer_verification_challenges ALTER COLUMN "tenantId" SET NOT NULL;

DROP INDEX "customers_phone_key";
DROP INDEX "customers_email_key";
DROP INDEX "customers_telegramUserId_key";

CREATE UNIQUE INDEX "customers_tenantId_phone_key"
  ON "customers"("tenantId", "phone");
CREATE UNIQUE INDEX "customers_tenantId_email_key"
  ON "customers"("tenantId", "email");
CREATE UNIQUE INDEX "customers_tenantId_telegramUserId_key"
  ON "customers"("tenantId", "telegramUserId");
CREATE INDEX "customers_tenantId_createdAt_idx"
  ON "customers"("tenantId", "createdAt");

DROP INDEX "customer_verification_challenges_phone_createdAt_idx";
DROP INDEX "customer_verification_challenges_phone_consumedAt_expiresAt_idx";
CREATE INDEX "customer_verification_challenges_tenantId_phone_createdAt_idx"
  ON "customer_verification_challenges"("tenantId", "phone", "createdAt");
CREATE INDEX "customer_verification_challenges_tenantId_phone_consumedAt_expiresAt_idx"
  ON "customer_verification_challenges"("tenantId", "phone", "consumedAt", "expiresAt");

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_verification_challenges"
  ADD CONSTRAINT "customer_verification_challenges_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
