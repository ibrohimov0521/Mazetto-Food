CREATE TABLE "cash_transfer_allocations" (
    "id" TEXT NOT NULL,
    "cashTransferId" TEXT NOT NULL,
    "sourceTransactionId" TEXT,
    "orderId" TEXT,
    "paymentId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_transfer_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cash_transfer_allocations_cashTransferId_idx"
ON "cash_transfer_allocations"("cashTransferId");

CREATE INDEX "cash_transfer_allocations_sourceTransactionId_idx"
ON "cash_transfer_allocations"("sourceTransactionId");

CREATE INDEX "cash_transfer_allocations_orderId_idx"
ON "cash_transfer_allocations"("orderId");

CREATE INDEX "cash_transfer_allocations_paymentId_idx"
ON "cash_transfer_allocations"("paymentId");

ALTER TABLE "cash_transfer_allocations"
ADD CONSTRAINT "cash_transfer_allocations_cashTransferId_fkey"
FOREIGN KEY ("cashTransferId") REFERENCES "cash_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_transfer_allocations"
ADD CONSTRAINT "cash_transfer_allocations_sourceTransactionId_fkey"
FOREIGN KEY ("sourceTransactionId") REFERENCES "cash_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_transfer_allocations"
ADD CONSTRAINT "cash_transfer_allocations_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_transfer_allocations"
ADD CONSTRAINT "cash_transfer_allocations_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
