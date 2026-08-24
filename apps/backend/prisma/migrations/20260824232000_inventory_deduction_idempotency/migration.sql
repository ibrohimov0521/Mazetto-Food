ALTER TABLE "stock_movements" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "sourceItemId" TEXT;

CREATE INDEX "stock_movements_sourceType_sourceId_idx" ON "stock_movements"("sourceType", "sourceId");
CREATE UNIQUE INDEX "stock_movements_sourceType_sourceItemId_ingredientId_warehouseId_key" ON "stock_movements"("sourceType", "sourceItemId", "ingredientId", "warehouseId");
