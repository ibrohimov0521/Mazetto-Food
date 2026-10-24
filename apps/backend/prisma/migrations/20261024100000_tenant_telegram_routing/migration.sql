CREATE TABLE "telegram_customer_contexts" (
    "chatId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "telegram_customer_contexts_pkey" PRIMARY KEY ("chatId", "telegramUserId")
);

CREATE INDEX "telegram_customer_contexts_tenantId_updatedAt_idx"
    ON "telegram_customer_contexts"("tenantId", "updatedAt");

ALTER TABLE "telegram_customer_contexts"
    ADD CONSTRAINT "telegram_customer_contexts_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tenant_telegram_configurations" (
    "tenantId" TEXT NOT NULL,
    "staffChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_telegram_configurations_pkey" PRIMARY KEY ("tenantId")
);

ALTER TABLE "tenant_telegram_configurations"
    ADD CONSTRAINT "tenant_telegram_configurations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
