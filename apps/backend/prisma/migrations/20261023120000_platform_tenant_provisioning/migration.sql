ALTER TABLE "restaurant_tenants"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "taxId" TEXT;

CREATE TABLE "tenant_features" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_features_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_features_tenantId_code_key"
  ON "tenant_features"("tenantId", "code");
CREATE INDEX "tenant_features_tenantId_isEnabled_idx"
  ON "tenant_features"("tenantId", "isEnabled");

ALTER TABLE "tenant_features"
  ADD CONSTRAINT "tenant_features_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "tenant_features" ("id", "tenantId", "code", "isEnabled", "createdAt", "updatedAt")
SELECT 'legacy_feature_' || md5(t."id" || ':' || feature.code), t."id",
       feature.code, feature.enabled, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "restaurant_tenants" t
CROSS JOIN (VALUES
  ('CUSTOMER_WEB', true), ('WEB_ORDERS', true),
  ('TELEGRAM_ORDERS', true), ('INVENTORY', true),
  ('KITCHEN_DISPLAY', true), ('TV_DISPLAY', false),
  ('DELIVERY', true), ('TABLE_SERVICE', true), ('MULTI_BRANCH', true)
) AS feature(code, enabled)
WHERE t."status" = 'ACTIVE'
ON CONFLICT ("tenantId", "code") DO NOTHING;
