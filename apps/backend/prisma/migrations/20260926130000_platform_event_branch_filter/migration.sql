ALTER TABLE "platform_site_events" ADD COLUMN "branchId" TEXT;

CREATE INDEX "platform_site_events_siteId_branchId_occurredAt_idx"
ON "platform_site_events"("siteId", "branchId", "occurredAt");
