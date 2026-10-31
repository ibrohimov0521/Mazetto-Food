CREATE TABLE "telegram_bot_users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "telegram_user_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_blocked" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "telegram_bot_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_bot_users_tenant_id_telegram_user_id_key"
    ON "telegram_bot_users"("tenant_id", "telegram_user_id");
CREATE INDEX "telegram_bot_users_tenant_id_is_blocked_last_seen_at_idx"
    ON "telegram_bot_users"("tenant_id", "is_blocked", "last_seen_at");
CREATE INDEX "telegram_bot_users_tenant_id_first_seen_at_idx"
    ON "telegram_bot_users"("tenant_id", "first_seen_at");

ALTER TABLE "telegram_bot_users"
    ADD CONSTRAINT "telegram_bot_users_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "restaurant_tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "telegram_bot_users" (
    "id", "tenant_id", "telegram_user_id", "chat_id",
    "first_seen_at", "last_seen_at", "is_blocked", "created_at", "updated_at"
)
SELECT
    'tg_' || md5(c."tenant_id" || ':' || c."telegram_user_id"),
    c."tenant_id",
    c."telegram_user_id",
    c."telegram_chat_id",
    COALESCE(c."telegram_linked_at", c."created_at"),
    COALESCE(c."telegram_linked_at", c."created_at"),
    NULL,
    COALESCE(c."telegram_linked_at", c."created_at"),
    CURRENT_TIMESTAMP
FROM "customers" c
WHERE c."telegram_user_id" IS NOT NULL
  AND c."telegram_chat_id" IS NOT NULL
ON CONFLICT ("tenant_id", "telegram_user_id") DO NOTHING;
