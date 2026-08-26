CREATE TYPE "CustomerOrderAttemptStatus" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "customer_order_attempts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "CustomerOrderAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "requestHash" TEXT NOT NULL,
    "customerOrderId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_order_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_order_attempts_customerId_idempotencyKey_key" ON "customer_order_attempts"("customerId", "idempotencyKey");
CREATE UNIQUE INDEX "customer_order_attempts_customerOrderId_key" ON "customer_order_attempts"("customerOrderId");
CREATE INDEX "customer_order_attempts_customerId_status_idx" ON "customer_order_attempts"("customerId", "status");
CREATE INDEX "customer_order_attempts_expiresAt_idx" ON "customer_order_attempts"("expiresAt");

ALTER TABLE "customer_order_attempts" ADD CONSTRAINT "customer_order_attempts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_order_attempts" ADD CONSTRAINT "customer_order_attempts_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "customer_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
