-- AlterEnum
ALTER TYPE "PrinterType" ADD VALUE IF NOT EXISTS 'THERMAL';
ALTER TYPE "PrinterType" ADD VALUE IF NOT EXISTS 'A4';

-- CreateEnum
CREATE TYPE "PrinterStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'SUCCESS';

-- AlterEnum
ALTER TYPE "CashTransactionType" ADD VALUE IF NOT EXISTS 'OPENING';
ALTER TYPE "CashTransactionType" ADD VALUE IF NOT EXISTS 'WITHDRAW';
ALTER TYPE "CashTransactionType" ADD VALUE IF NOT EXISTS 'CLOSING';

-- AlterTable
ALTER TABLE "printers" ADD COLUMN "status" "PrinterStatus" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN "metadata" JSONB;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "createdById" TEXT,
ADD COLUMN "methodCode" TEXT,
ADD COLUMN "transactionId" TEXT;

-- AlterTable
ALTER TABLE "cash_transactions" ADD COLUMN "createdById" TEXT;

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "printed" BOOLEAN NOT NULL DEFAULT false,
    "printedAt" TIMESTAMP(3),
    "content" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashier_shifts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "openingCash" DECIMAL(12,2) NOT NULL,
    "closingCash" DECIMAL(12,2),
    "expectedCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(12,2),
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receiptNumber_key" ON "receipts"("receiptNumber");

-- CreateIndex
CREATE INDEX "receipts_orderId_idx" ON "receipts"("orderId");

-- CreateIndex
CREATE INDEX "receipts_branchId_createdAt_idx" ON "receipts"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "receipts_printed_idx" ON "receipts"("printed");

-- CreateIndex
CREATE INDEX "cashier_shifts_userId_status_idx" ON "cashier_shifts"("userId", "status");

-- CreateIndex
CREATE INDEX "cashier_shifts_branchId_openedAt_idx" ON "cashier_shifts"("branchId", "openedAt");

-- CreateIndex
CREATE INDEX "payments_createdById_idx" ON "payments"("createdById");

-- CreateIndex
CREATE INDEX "payments_methodCode_idx" ON "payments"("methodCode");

-- CreateIndex
CREATE INDEX "payments_transactionId_idx" ON "payments"("transactionId");

-- CreateIndex
CREATE INDEX "cash_transactions_createdById_idx" ON "cash_transactions"("createdById");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
