ALTER TABLE "customers"
    ADD COLUMN "webLastSeenAt" TIMESTAMP(3);

-- Existing browser sessions prove that a customer has used the website.
-- Unlinked legacy customers were created through the website verification flow;
-- Telegram-only customers remain Telegram-only unless a browser session exists.
UPDATE "customers" AS customer
SET "webLastSeenAt" = COALESCE(
    (
        SELECT MAX(session."createdAt")
        FROM "customer_sessions" AS session
        WHERE session."customerId" = customer."id"
    ),
    CASE
        WHEN customer."telegramLinkedAt" IS NULL THEN customer."createdAt"
        ELSE NULL
    END
)
WHERE customer."webLastSeenAt" IS NULL;

CREATE INDEX "customers_tenantId_webLastSeenAt_idx"
    ON "customers"("tenantId", "webLastSeenAt");
