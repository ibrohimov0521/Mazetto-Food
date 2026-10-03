CREATE TABLE "notification_dead_letters" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "failedAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_dead_letters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_dead_letters_tenantId_messageId_key"
ON "notification_dead_letters"("tenantId", "messageId");

CREATE INDEX "notification_dead_letters_tenantId_failedAt_idx"
ON "notification_dead_letters"("tenantId", "failedAt");

ALTER TABLE "notification_dead_letters"
ADD CONSTRAINT "notification_dead_letters_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
