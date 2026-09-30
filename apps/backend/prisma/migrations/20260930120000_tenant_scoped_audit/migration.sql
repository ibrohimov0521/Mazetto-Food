ALTER TABLE "audit_logs" ADD COLUMN "tenantId" TEXT;

CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
