ALTER TABLE "orders"
ADD COLUMN "tenantId" TEXT;

UPDATE "orders" AS order_row
SET "tenantId" = branch."tenantId"
FROM "branches" AS branch
WHERE branch."id" = order_row."branchId";

ALTER TABLE "orders"
ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "orders"
ADD CONSTRAINT "orders_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "orders_tenantId_source_displayOrderDate_displayOrderSequence_key"
ON "orders"("tenantId", "source", "displayOrderDate", "displayOrderSequence");

DROP INDEX "orders_source_displayOrderDate_displayOrderSequence_key";

CREATE INDEX "orders_tenantId_source_displayOrderDate_idx"
ON "orders"("tenantId", "source", "displayOrderDate");
