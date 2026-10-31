CREATE TABLE "telegram_bot_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBlocked" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "telegram_bot_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_bot_users_tenantId_telegramUserId_key"
    ON "telegram_bot_users"("tenantId", "telegramUserId");
CREATE INDEX "telegram_bot_users_tenantId_isBlocked_lastSeenAt_idx"
    ON "telegram_bot_users"("tenantId", "isBlocked", "lastSeenAt");
CREATE INDEX "telegram_bot_users_tenantId_firstSeenAt_idx"
    ON "telegram_bot_users"("tenantId", "firstSeenAt");

ALTER TABLE "telegram_bot_users"
    ADD CONSTRAINT "telegram_bot_users_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "telegram_bot_users" (
    "id", "tenantId", "telegramUserId", "chatId",
    "firstSeenAt", "lastSeenAt", "isBlocked", "createdAt", "updatedAt"
)
SELECT
    'tg_' || md5(c."tenantId" || ':' || c."telegramUserId"),
    c."tenantId",
    c."telegramUserId",
    c."telegramChatId",
    COALESCE(c."telegramLinkedAt", c."createdAt"),
    COALESCE(c."telegramLinkedAt", c."createdAt"),
    NULL,
    COALESCE(c."telegramLinkedAt", c."createdAt"),
    CURRENT_TIMESTAMP
FROM "customers" c
WHERE c."telegramUserId" IS NOT NULL
  AND c."telegramChatId" IS NOT NULL
ON CONFLICT ("tenantId", "telegramUserId") DO NOTHING;
