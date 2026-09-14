CREATE TYPE "OrderState" AS ENUM (
  'DRAFT',
  'PLACED',
  'ACCEPTED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "orders"
ADD COLUMN "orderState" "OrderState" NOT NULL DEFAULT 'PLACED';

UPDATE "orders"
SET "orderState" = CASE
  WHEN "status" = 'COMPLETED' THEN 'COMPLETED'::"OrderState"
  WHEN "status" = 'CANCELLED' THEN 'CANCELLED'::"OrderState"
  WHEN "status" IN ('CONFIRMED', 'PREPARING', 'READY', 'SERVED') THEN 'ACCEPTED'::"OrderState"
  ELSE 'PLACED'::"OrderState"
END;

CREATE INDEX "orders_branchId_orderState_createdAt_idx"
ON "orders"("branchId", "orderState", "createdAt");

CREATE TABLE "order_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "source" TEXT NOT NULL,
  "previousState" "OrderState",
  "newState" "OrderState",
  "payload" JSONB,
  "reasonCode" TEXT,
  "correlationId" TEXT NOT NULL,
  "causationId" TEXT,
  "idempotencyKey" TEXT,
  "aggregateVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
  "id" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "branchId" TEXT,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "correlationId" TEXT NOT NULL,
  "causationId" TEXT,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "order_events"
ADD CONSTRAINT "order_events_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "outbox_events"
ADD CONSTRAINT "outbox_events_sourceEventId_fkey"
FOREIGN KEY ("sourceEventId") REFERENCES "order_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "order_events_orderId_aggregateVersion_key"
ON "order_events"("orderId", "aggregateVersion");

CREATE INDEX "order_events_branchId_createdAt_idx"
ON "order_events"("branchId", "createdAt");

CREATE INDEX "order_events_eventType_createdAt_idx"
ON "order_events"("eventType", "createdAt");

CREATE INDEX "order_events_correlationId_idx"
ON "order_events"("correlationId");

CREATE INDEX "order_events_idempotencyKey_idx"
ON "order_events"("idempotencyKey");

CREATE UNIQUE INDEX "outbox_events_sourceEventId_key"
ON "outbox_events"("sourceEventId");

CREATE INDEX "outbox_events_processedAt_availableAt_createdAt_idx"
ON "outbox_events"("processedAt", "availableAt", "createdAt");

CREATE INDEX "outbox_events_aggregateType_aggregateId_idx"
ON "outbox_events"("aggregateType", "aggregateId");

CREATE INDEX "outbox_events_branchId_createdAt_idx"
ON "outbox_events"("branchId", "createdAt");

INSERT INTO "order_events" (
  "id",
  "orderId",
  "branchId",
  "eventType",
  "actorType",
  "actorId",
  "source",
  "previousState",
  "newState",
  "payload",
  "reasonCode",
  "correlationId",
  "aggregateVersion",
  "createdAt"
)
SELECT
  'backfill_' || "id",
  "id",
  "branchId",
  'OrderImported',
  'SYSTEM',
  NULL,
  'MIGRATION',
  NULL,
  "orderState",
  jsonb_build_object('legacyStatus', "status"::text),
  'EXISTING_ORDER_BACKFILL',
  'migration:20260914103000:' || "id",
  "version",
  "createdAt"
FROM "orders";
