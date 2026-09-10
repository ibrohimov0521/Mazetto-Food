CREATE TYPE "ShiftType" AS ENUM ('CASHIER', 'COURIER');

CREATE TYPE "CashTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'DISPUTED');

ALTER TABLE "shifts" ADD COLUMN "type" "ShiftType" NOT NULL DEFAULT 'CASHIER';

CREATE TABLE "cash_transfers" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "fromShiftId" TEXT NOT NULL,
  "toShiftId" TEXT,
  "status" "CashTransferStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT,
  "createdById" TEXT,
  "acceptedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  CONSTRAINT "cash_transfers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cash_transactions" ADD COLUMN "cashTransferId" TEXT;

CREATE INDEX "cash_transfers_branchId_status_createdAt_idx" ON "cash_transfers"("branchId", "status", "createdAt");
CREATE INDEX "cash_transfers_fromShiftId_createdAt_idx" ON "cash_transfers"("fromShiftId", "createdAt");
CREATE INDEX "cash_transfers_toShiftId_createdAt_idx" ON "cash_transfers"("toShiftId", "createdAt");
CREATE INDEX "cash_transactions_cashTransferId_idx" ON "cash_transactions"("cashTransferId");

ALTER TABLE "cash_transfers" ADD CONSTRAINT "cash_transfers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_transfers" ADD CONSTRAINT "cash_transfers_fromShiftId_fkey" FOREIGN KEY ("fromShiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_transfers" ADD CONSTRAINT "cash_transfers_toShiftId_fkey" FOREIGN KEY ("toShiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_cashTransferId_fkey" FOREIGN KEY ("cashTransferId") REFERENCES "cash_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
