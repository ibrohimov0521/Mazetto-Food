ALTER TABLE "roles"
ADD COLUMN "isBranchScoped" BOOLEAN NOT NULL DEFAULT false;

UPDATE "roles"
SET "isBranchScoped" = true
WHERE "code" IN (
  'ADMIN',
  'BRANCH_MANAGER',
  'CASHIER',
  'WAITER',
  'KITCHEN',
  'COURIER'
);
