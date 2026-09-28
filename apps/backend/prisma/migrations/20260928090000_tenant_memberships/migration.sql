CREATE TYPE "TenantMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

CREATE TABLE "tenant_memberships" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT,
    "status" "TenantMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_membership_roles" (
    "membershipId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_membership_roles_pkey" PRIMARY KEY ("membershipId", "roleId")
);

ALTER TABLE "sessions" ADD COLUMN "membershipId" TEXT;

CREATE UNIQUE INDEX "tenant_memberships_tenantId_userId_key" ON "tenant_memberships"("tenantId", "userId");
CREATE INDEX "tenant_memberships_tenantId_status_idx" ON "tenant_memberships"("tenantId", "status");
CREATE INDEX "tenant_memberships_userId_status_idx" ON "tenant_memberships"("userId", "status");
CREATE INDEX "tenant_memberships_branchId_idx" ON "tenant_memberships"("branchId");
CREATE INDEX "tenant_membership_roles_roleId_idx" ON "tenant_membership_roles"("roleId");
CREATE INDEX "tenant_membership_roles_assignedById_idx" ON "tenant_membership_roles"("assignedById");
CREATE INDEX "sessions_membershipId_idx" ON "sessions"("membershipId");

ALTER TABLE "tenant_memberships"
  ADD CONSTRAINT "tenant_memberships_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships"
  ADD CONSTRAINT "tenant_memberships_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships"
  ADD CONSTRAINT "tenant_memberships_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_membership_roles"
  ADD CONSTRAINT "tenant_membership_roles_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "tenant_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_membership_roles"
  ADD CONSTRAINT "tenant_membership_roles_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_membership_roles"
  ADD CONSTRAINT "tenant_membership_roles_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH eligible_memberships AS (
    SELECT DISTINCT b."tenantId", e."userId", b."id" AS "branchId"
    FROM "employees" e
    JOIN "branches" b ON b."id" = e."branchId"
    JOIN "restaurant_tenants" t ON t."id" = b."tenantId"
    WHERE e."userId" IS NOT NULL AND t."status" = 'ACTIVE'
    UNION
    SELECT DISTINCT t."id", ur."userId", NULL::TEXT AS "branchId"
    FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."roleId"
    JOIN "restaurant_tenants" t ON t."status" = 'ACTIVE'
    WHERE LEFT(r."code", 9) <> 'PLATFORM_'
      AND (SELECT COUNT(*) FROM "restaurant_tenants" active_tenant WHERE active_tenant."status" = 'ACTIVE') = 1
)
INSERT INTO "tenant_memberships" ("id", "tenantId", "userId", "branchId", "status", "createdAt", "updatedAt")
SELECT
    'legacy_' || md5(eligible."tenantId" || ':' || eligible."userId"),
    eligible."tenantId",
    eligible."userId",
    eligible."branchId",
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM eligible_memberships eligible
ON CONFLICT ("tenantId", "userId") DO NOTHING;

INSERT INTO "tenant_membership_roles" ("membershipId", "roleId", "assignedById", "assignedAt")
SELECT DISTINCT tm."id", ur."roleId", ur."assignedById", ur."assignedAt"
FROM "user_roles" ur
JOIN "roles" r ON r."id" = ur."roleId"
JOIN "tenant_memberships" tm ON tm."userId" = ur."userId"
WHERE LEFT(r."code", 9) <> 'PLATFORM_'
  AND (
    EXISTS (
      SELECT 1
      FROM "employees" e
      JOIN "branches" b ON b."id" = e."branchId"
      WHERE e."userId" = ur."userId" AND b."tenantId" = tm."tenantId"
    )
    OR (
      NOT EXISTS (SELECT 1 FROM "employees" e WHERE e."userId" = ur."userId")
      AND (SELECT COUNT(*) FROM "restaurant_tenants" active_tenant WHERE active_tenant."status" = 'ACTIVE') = 1
    )
  )
ON CONFLICT ("membershipId", "roleId") DO NOTHING;
