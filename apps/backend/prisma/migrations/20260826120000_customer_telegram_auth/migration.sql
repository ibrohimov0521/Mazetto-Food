ALTER TABLE "customers"
ADD COLUMN "telegramUserId" TEXT,
ADD COLUMN "telegramChatId" TEXT,
ADD COLUMN "telegramLinkedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "customers_telegramUserId_key" ON "customers"("telegramUserId");
CREATE INDEX "customers_telegramChatId_idx" ON "customers"("telegramChatId");
