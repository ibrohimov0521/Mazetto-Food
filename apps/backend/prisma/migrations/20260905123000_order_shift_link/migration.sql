-- Link new POS orders directly to the cashier shift without forcing historical backfill.
ALTER TABLE "orders"
  ADD COLUMN "shiftId" TEXT;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "shifts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "orders_shiftId_idx" ON "orders"("shiftId");
