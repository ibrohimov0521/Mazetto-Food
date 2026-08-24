CREATE TABLE "payment_operations" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdById" TEXT,
    "employeeId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_operations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payments" ADD COLUMN "paymentOperationId" TEXT;
ALTER TABLE "payments" ADD COLUMN "operationTenderIndex" INTEGER;

CREATE UNIQUE INDEX "payment_operations_idempotencyKey_key" ON "payment_operations"("idempotencyKey");
CREATE INDEX "payment_operations_orderId_idx" ON "payment_operations"("orderId");
CREATE INDEX "payment_operations_status_idx" ON "payment_operations"("status");
CREATE INDEX "payment_operations_createdById_idx" ON "payment_operations"("createdById");
CREATE INDEX "payment_operations_employeeId_idx" ON "payment_operations"("employeeId");

CREATE INDEX "payments_paymentOperationId_idx" ON "payments"("paymentOperationId");
CREATE UNIQUE INDEX "payments_paymentOperationId_operationTenderIndex_key" ON "payments"("paymentOperationId", "operationTenderIndex");
CREATE UNIQUE INDEX "receipts_orderId_key" ON "receipts"("orderId");

ALTER TABLE "payment_operations" ADD CONSTRAINT "payment_operations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_operations" ADD CONSTRAINT "payment_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_operations" ADD CONSTRAINT "payment_operations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_paymentOperationId_fkey" FOREIGN KEY ("paymentOperationId") REFERENCES "payment_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
