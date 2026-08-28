CREATE TABLE "telegram_checkout_sessions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'ORDER_TYPE',
    "branchId" TEXT,
    "orderType" "CustomerOrderType",
    "address" TEXT,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_checkout_sessions_customerId_chatId_key" ON "telegram_checkout_sessions"("customerId", "chatId");
CREATE INDEX "telegram_checkout_sessions_chatId_idx" ON "telegram_checkout_sessions"("chatId");
CREATE INDEX "telegram_checkout_sessions_expiresAt_idx" ON "telegram_checkout_sessions"("expiresAt");
CREATE INDEX "telegram_checkout_sessions_branchId_idx" ON "telegram_checkout_sessions"("branchId");

ALTER TABLE "telegram_checkout_sessions"
ADD CONSTRAINT "telegram_checkout_sessions_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "telegram_checkout_sessions"
ADD CONSTRAINT "telegram_checkout_sessions_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
