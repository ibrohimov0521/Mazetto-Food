ALTER TABLE "platform_site_events"
ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN "acknowledgedById" TEXT;

CREATE INDEX "platform_site_events_acknowledgedAt_occurredAt_idx"
ON "platform_site_events"("acknowledgedAt", "occurredAt");

ALTER TABLE "platform_site_events"
ADD CONSTRAINT "platform_site_events_acknowledgedById_fkey"
FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
