ALTER TABLE "orders"
ADD COLUMN "displayOrderNumber" TEXT,
ADD COLUMN "displayOrderDate" DATE,
ADD COLUMN "displayOrderSequence" INTEGER,
ADD COLUMN "staffTelegramChatId" TEXT,
ADD COLUMN "staffTelegramMessageId" INTEGER;

CREATE UNIQUE INDEX "orders_source_displayOrderDate_displayOrderSequence_key"
ON "orders"("source", "displayOrderDate", "displayOrderSequence");

CREATE INDEX "orders_displayOrderDate_source_idx"
ON "orders"("displayOrderDate", "source");
