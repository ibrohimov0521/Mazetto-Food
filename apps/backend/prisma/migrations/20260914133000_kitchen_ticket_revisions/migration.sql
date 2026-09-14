ALTER TABLE "orders"
ADD COLUMN "parentOrderId" TEXT,
ADD COLUMN "supplementNumber" INTEGER;

ALTER TABLE "kitchen_tickets"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "revisionNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "isSupplement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sourceOrderVersion" INTEGER NOT NULL DEFAULT 1;

UPDATE "kitchen_tickets" kt
SET "isSupplement" = o."isSupplemental",
    "sourceOrderVersion" = o."version"
FROM "orders" o
WHERE o."id" = kt."orderId";

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "orderId" ORDER BY "createdAt", "id"
  ) AS revision
  FROM "kitchen_tickets"
)
UPDATE "kitchen_tickets" kt
SET "revisionNumber" = ranked.revision
FROM ranked
WHERE ranked."id" = kt."id";

CREATE TABLE "kitchen_ticket_items" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "notes" TEXT,
    "modifierSnapshot" JSONB,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kitchen_ticket_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kitchen_ticket_events" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" "KitchenTicketStatus",
    "newStatus" "KitchenTicketStatus",
    "actorId" TEXT,
    "reason" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kitchen_ticket_events_pkey" PRIMARY KEY ("id")
);

INSERT INTO "kitchen_ticket_items" (
  "id", "ticketId", "orderItemId", "productName", "variantName",
  "quantity", "notes", "modifierSnapshot", "status", "createdAt"
)
SELECT
  'kti_' || md5(kt."id" || ':' || oi."id"), kt."id", oi."id",
  oi."productName", oi."variantName", oi."quantity", oi."notes",
  oi."modifierSnapshot", oi."status", oi."createdAt"
FROM "kitchen_tickets" kt
JOIN "order_items" oi ON oi."orderId" = kt."orderId";

INSERT INTO "kitchen_ticket_events" (
  "id", "ticketId", "eventType", "previousStatus", "newStatus",
  "actorId", "reason", "version", "createdAt"
)
SELECT
  'kte_' || md5(kt."id" || ':1'), kt."id", 'KitchenTicketImported',
  NULL, kt."status", NULL, 'Existing ticket imported', 1, kt."createdAt"
FROM "kitchen_tickets" kt;

CREATE INDEX "orders_parentOrderId_idx" ON "orders"("parentOrderId");
CREATE UNIQUE INDEX "orders_parentOrderId_supplementNumber_key"
ON "orders"("parentOrderId", "supplementNumber");
CREATE UNIQUE INDEX "kitchen_tickets_orderId_revisionNumber_key"
ON "kitchen_tickets"("orderId", "revisionNumber");
CREATE UNIQUE INDEX "kitchen_ticket_items_ticketId_orderItemId_key"
ON "kitchen_ticket_items"("ticketId", "orderItemId");
CREATE INDEX "kitchen_ticket_items_ticketId_idx" ON "kitchen_ticket_items"("ticketId");
CREATE INDEX "kitchen_ticket_items_orderItemId_idx" ON "kitchen_ticket_items"("orderItemId");
CREATE UNIQUE INDEX "kitchen_ticket_events_ticketId_version_key"
ON "kitchen_ticket_events"("ticketId", "version");
CREATE INDEX "kitchen_ticket_events_ticketId_createdAt_idx"
ON "kitchen_ticket_events"("ticketId", "createdAt");
CREATE INDEX "kitchen_ticket_events_eventType_createdAt_idx"
ON "kitchen_ticket_events"("eventType", "createdAt");

ALTER TABLE "orders" ADD CONSTRAINT "orders_parentOrderId_fkey"
FOREIGN KEY ("parentOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "kitchen_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kitchen_ticket_events" ADD CONSTRAINT "kitchen_ticket_events_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "kitchen_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
