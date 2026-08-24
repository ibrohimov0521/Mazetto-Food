-- Rename existing lifecycle labels to the Phase 4A order language.
ALTER TYPE "OrderStatus" RENAME VALUE 'DRAFT' TO 'NEW';
ALTER TYPE "OrderStatus" RENAME VALUE 'OPEN' TO 'CONFIRMED';
ALTER TYPE "OrderStatus" RENAME VALUE 'SENT_TO_KITCHEN' TO 'PREPARING';
ALTER TYPE "OrderStatus" ADD VALUE 'SERVED';

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING');

-- AlterTable
ALTER TABLE "halls" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "restaurant_tables"
ADD COLUMN "number" INTEGER,
ADD COLUMN "capacity" INTEGER,
ADD COLUMN "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE';

UPDATE "restaurant_tables"
SET "capacity" = COALESCE("seats", "capacity"),
    "number" = COALESCE("number", "sortOrder");

-- AlterTable
ALTER TABLE "orders"
ADD COLUMN "waiterId" TEXT,
ADD COLUMN "servedById" TEXT;

UPDATE "orders"
SET "waiterId" = "createdById"
WHERE "type" = 'DINE_IN' AND "waiterId" IS NULL;

-- CreateIndex
CREATE INDEX "restaurant_tables_branchId_status_idx" ON "restaurant_tables"("branchId", "status");

-- CreateIndex
CREATE INDEX "orders_waiterId_idx" ON "orders"("waiterId");

-- CreateIndex
CREATE INDEX "orders_servedById_idx" ON "orders"("servedById");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_servedById_fkey" FOREIGN KEY ("servedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
