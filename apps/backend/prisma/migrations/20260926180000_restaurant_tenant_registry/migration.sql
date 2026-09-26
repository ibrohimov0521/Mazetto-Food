CREATE TYPE "RestaurantTenantStatus" AS ENUM (
    'PROVISIONING',
    'ACTIVE',
    'SUSPENDED',
    'ARCHIVED'
);

CREATE TYPE "TenantDomainStatus" AS ENUM (
    'PENDING',
    'VERIFIED',
    'DISABLED'
);

CREATE TABLE "restaurant_tenants" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RestaurantTenantStatus" NOT NULL DEFAULT 'PROVISIONING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "restaurant_tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "restaurant_tenants_code_key"
ON "restaurant_tenants"("code");

CREATE INDEX "restaurant_tenants_status_createdAt_idx"
ON "restaurant_tenants"("status", "createdAt");

INSERT INTO "restaurant_tenants" ("id", "code", "name", "status", "createdAt", "updatedAt")
VALUES (
    'tenant_mazetto_food',
    'MAZETTO_FOOD',
    'Mazetto Food',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

CREATE TABLE "tenant_domains" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "TenantDomainStatus" NOT NULL DEFAULT 'PENDING',
    "verificationTokenHash" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_domains_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_domains_hostname_key"
ON "tenant_domains"("hostname");

CREATE UNIQUE INDEX "tenant_domains_verificationTokenHash_key"
ON "tenant_domains"("verificationTokenHash");

CREATE INDEX "tenant_domains_tenantId_status_idx"
ON "tenant_domains"("tenantId", "status");

ALTER TABLE "branches"
ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_mazetto_food';

CREATE INDEX "branches_tenantId_isActive_idx"
ON "branches"("tenantId", "isActive");

ALTER TABLE "branches"
ADD CONSTRAINT "branches_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_domains"
ADD CONSTRAINT "tenant_domains_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
