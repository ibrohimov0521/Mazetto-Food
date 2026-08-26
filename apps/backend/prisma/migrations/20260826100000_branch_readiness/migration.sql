-- CreateEnum
CREATE TYPE "BranchDayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "ProductBranchAvailabilityStatus" AS ENUM ('AVAILABLE', 'OUT_OF_STOCK', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "branches" ADD COLUMN "acceptsOrders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isTemporarilyClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "latitude" DECIMAL(10,7),
ADD COLUMN "longitude" DECIMAL(10,7),
ADD COLUMN "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Tashkent';

-- CreateTable
CREATE TABLE "branch_working_hours" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "dayOfWeek" "BranchDayOfWeek" NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_branch_availabilities" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "ProductBranchAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_branch_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branches_isActive_acceptsOrders_idx" ON "branches"("isActive", "acceptsOrders");

-- CreateIndex
CREATE INDEX "branch_working_hours_branchId_isClosed_idx" ON "branch_working_hours"("branchId", "isClosed");

-- CreateIndex
CREATE UNIQUE INDEX "branch_working_hours_branchId_dayOfWeek_key" ON "branch_working_hours"("branchId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "product_branch_availabilities_branchId_status_idx" ON "product_branch_availabilities"("branchId", "status");

-- CreateIndex
CREATE INDEX "product_branch_availabilities_productId_status_idx" ON "product_branch_availabilities"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_branch_availabilities_branchId_productId_key" ON "product_branch_availabilities"("branchId", "productId");

-- AddForeignKey
ALTER TABLE "branch_working_hours" ADD CONSTRAINT "branch_working_hours_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_branch_availabilities" ADD CONSTRAINT "product_branch_availabilities_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_branch_availabilities" ADD CONSTRAINT "product_branch_availabilities_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
