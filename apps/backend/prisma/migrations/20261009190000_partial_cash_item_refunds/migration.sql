ALTER TABLE "payment_refunds"
  ADD COLUMN IF NOT EXISTS "orderItemId" TEXT;

DROP INDEX IF EXISTS "payment_refunds_paymentId_key";

CREATE INDEX IF NOT EXISTS "payment_refunds_paymentId_idx"
  ON "payment_refunds"("paymentId");

CREATE INDEX IF NOT EXISTS "payment_refunds_orderItemId_idx"
  ON "payment_refunds"("orderItemId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_refunds_orderItemId_fkey'
  ) THEN
    ALTER TABLE "payment_refunds"
      ADD CONSTRAINT "payment_refunds_orderItemId_fkey"
      FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
