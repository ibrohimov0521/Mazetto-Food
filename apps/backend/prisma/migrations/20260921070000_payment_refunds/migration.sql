CREATE TABLE IF NOT EXISTS "payment_refunds" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_paymentId_fkey') THEN
    ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_branchId_fkey') THEN
    ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_shiftId_fkey') THEN
    ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_employeeId_fkey') THEN
    ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_createdById_fkey') THEN
    ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_paymentId_key" ON "payment_refunds"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_idempotencyKey_key" ON "payment_refunds"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "payment_refunds_branchId_createdAt_idx" ON "payment_refunds"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "payment_refunds_shiftId_createdAt_idx" ON "payment_refunds"("shiftId", "createdAt");
CREATE INDEX IF NOT EXISTS "payment_refunds_employeeId_idx" ON "payment_refunds"("employeeId");
CREATE INDEX IF NOT EXISTS "payment_refunds_createdById_idx" ON "payment_refunds"("createdById");
