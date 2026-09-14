ALTER TABLE "kitchen_ticket_items"
ADD COLUMN "stationRouting" "ProductPrinterRouting" NOT NULL DEFAULT 'NONE',
ADD COLUMN "printerIdSnapshot" TEXT,
ADD COLUMN "printerNameSnapshot" TEXT,
ADD COLUMN "printerTypeSnapshot" "PrinterType";

UPDATE "kitchen_ticket_items" kti
SET "stationRouting" = COALESCE(
      p."printerRouting",
      'NONE'::"ProductPrinterRouting"
    ),
    "printerIdSnapshot" = p."printerId",
    "printerNameSnapshot" = pr."name",
    "printerTypeSnapshot" = pr."type"
FROM "order_items" oi
LEFT JOIN "products" p ON p."id" = oi."productId"
LEFT JOIN "printers" pr ON pr."id" = p."printerId"
WHERE kti."orderItemId" = oi."id";

ALTER TABLE "kitchen_ticket_events"
ADD COLUMN "orderItemId" TEXT,
ADD COLUMN "correlationId" TEXT,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "payload" JSONB;

CREATE UNIQUE INDEX "kitchen_ticket_events_ticketId_idempotencyKey_key"
ON "kitchen_ticket_events"("ticketId", "idempotencyKey");
CREATE INDEX "kitchen_ticket_events_orderItemId_createdAt_idx"
ON "kitchen_ticket_events"("orderItemId", "createdAt");
