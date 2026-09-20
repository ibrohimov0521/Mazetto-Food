ALTER TABLE "receipts"
ADD COLUMN "documentType" TEXT NOT NULL DEFAULT 'RECEIPT';

UPDATE "receipts"
SET "documentType" = CASE
  WHEN "content"->>'documentType' = 'CANCELLATION' THEN 'CANCELLATION'
  ELSE 'RECEIPT'
END;

DROP INDEX IF EXISTS "receipts_orderId_key";
CREATE UNIQUE INDEX "receipts_orderId_documentType_key"
ON "receipts"("orderId", "documentType");
CREATE INDEX "receipts_documentType_createdAt_idx"
ON "receipts"("documentType", "createdAt");
