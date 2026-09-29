BEGIN;
DO $$
DECLARE active_tenant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_tenant_count
  FROM restaurant_tenants
  WHERE status = 'ACTIVE';

  IF active_tenant_count <> 1 THEN
    RAISE EXCEPTION
      'Tenant settings backfill requires exactly one ACTIVE restaurant; found %',
      active_tenant_count;
  END IF;
END $$;

ALTER TABLE "settings" ADD COLUMN "tenantId" TEXT;
UPDATE "settings"
SET "tenantId" = (SELECT id FROM restaurant_tenants WHERE status = 'ACTIVE' LIMIT 1);
ALTER TABLE "settings" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";
ALTER TABLE "settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("tenantId", "key");
DROP INDEX "settings_isPublic_idx";
CREATE INDEX "settings_tenantId_isPublic_idx" ON "settings"("tenantId", "isPublic");
ALTER TABLE "settings"
  ADD CONSTRAINT "settings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
