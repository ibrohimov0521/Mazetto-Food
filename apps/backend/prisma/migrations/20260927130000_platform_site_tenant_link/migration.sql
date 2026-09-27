ALTER TABLE "platform_sites"
ADD COLUMN "tenantId" TEXT;

CREATE INDEX "platform_sites_tenantId_isActive_idx"
ON "platform_sites"("tenantId", "isActive");

ALTER TABLE "platform_sites"
ADD CONSTRAINT "platform_sites_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
