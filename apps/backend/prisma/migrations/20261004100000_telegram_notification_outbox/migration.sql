CREATE TABLE "notification_outbox" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_outbox_status_check"
      CHECK ("status" IN ('PENDING', 'PROCESSING', 'DELIVERED', 'UNCERTAIN', 'FAILED')),
    CONSTRAINT "notification_outbox_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "restaurant_tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "notification_outbox_tenantId_dedupeKey_key"
ON "notification_outbox"("tenantId", "dedupeKey");

CREATE INDEX "notification_outbox_status_scheduledAt_createdAt_idx"
ON "notification_outbox"("status", "scheduledAt", "createdAt");

CREATE INDEX "notification_outbox_status_leaseExpiresAt_idx"
ON "notification_outbox"("status", "leaseExpiresAt");

CREATE INDEX "notification_outbox_tenantId_status_createdAt_idx"
ON "notification_outbox"("tenantId", "status", "createdAt");

CREATE UNIQUE INDEX "notification_outbox_serialized_order_processing_key"
ON "notification_outbox"("tenantId", "orderId", "kind")
WHERE "kind" IN ('customer_status', 'staff_status_refresh')
  AND "status" = 'PROCESSING';
