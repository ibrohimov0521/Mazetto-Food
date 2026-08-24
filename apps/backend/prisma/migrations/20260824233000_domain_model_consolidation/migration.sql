-- Consolidate legacy cashier shifts into the canonical shifts table.
-- Rows are archived first so data is not silently discarded if a user has no linked employee.
CREATE TABLE IF NOT EXISTS "legacy_cashier_shifts_archive" AS
SELECT *
FROM "cashier_shifts"
WHERE false;

INSERT INTO "legacy_cashier_shifts_archive"
SELECT cs.*
FROM "cashier_shifts" cs
WHERE NOT EXISTS (
  SELECT 1
  FROM "legacy_cashier_shifts_archive" archived
  WHERE archived.id = cs.id
);

WITH numbered_cashier_shifts AS (
  SELECT
    cs.*,
    e.id AS "employeeId",
    COALESCE((
      SELECT MAX(s."shiftNumber")
      FROM "shifts" s
      WHERE s."branchId" = cs."branchId"
    ), 0) + ROW_NUMBER() OVER (
      PARTITION BY cs."branchId"
      ORDER BY cs."openedAt", cs.id
    ) AS "nextShiftNumber"
  FROM "cashier_shifts" cs
  JOIN "employees" e ON e."userId" = cs."userId" AND e."branchId" = cs."branchId"
  WHERE NOT EXISTS (
    SELECT 1
    FROM "shifts" s
    WHERE s.id = cs.id
  )
)
INSERT INTO "shifts" (
  id,
  "branchId",
  "employeeId",
  "deviceId",
  "shiftNumber",
  status,
  "openedAt",
  "closedAt",
  "openingBalance",
  "closingBalance",
  "salesTotal",
  "cashTotal",
  "terminalTotal",
  "clickTotal",
  "paymeTotal",
  "otherPaymentTotal",
  "refundsTotal",
  "cancellationsTotal",
  "expensesTotal",
  "incomeTotal",
  "orderCount",
  "createdAt",
  "updatedAt"
)
SELECT
  id,
  "branchId",
  "employeeId",
  NULL,
  "nextShiftNumber",
  status,
  "openedAt",
  "closedAt",
  "openingCash",
  "closingCash",
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  "createdAt",
  "updatedAt"
FROM numbered_cashier_shifts;

ALTER TABLE "cashier_shifts" DROP CONSTRAINT IF EXISTS "cashier_shifts_branchId_fkey";
ALTER TABLE "cashier_shifts" DROP CONSTRAINT IF EXISTS "cashier_shifts_userId_fkey";
DROP TABLE "cashier_shifts";

DROP INDEX IF EXISTS "customer_orders_branchId_status_idx";
DROP INDEX IF EXISTS "customer_orders_status_createdAt_idx";
ALTER TABLE "customer_orders" DROP COLUMN "status";
DROP TYPE IF EXISTS "CustomerOrderStatus";
CREATE INDEX "customer_orders_branchId_createdAt_idx" ON "customer_orders"("branchId", "createdAt");

DROP INDEX IF EXISTS "recipe_items_variantId_idx";
ALTER TABLE "recipe_items" DROP COLUMN "variantId";
