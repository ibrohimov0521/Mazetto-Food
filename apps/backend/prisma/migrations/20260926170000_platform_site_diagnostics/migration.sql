CREATE TABLE "platform_site_diagnostics" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_site_diagnostics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_site_diagnostics_siteId_externalId_key"
ON "platform_site_diagnostics"("siteId", "externalId");

CREATE INDEX "platform_site_diagnostics_siteId_occurredAt_idx"
ON "platform_site_diagnostics"("siteId", "occurredAt");

CREATE INDEX "platform_site_diagnostics_severity_occurredAt_idx"
ON "platform_site_diagnostics"("severity", "occurredAt");

ALTER TABLE "platform_site_diagnostics"
ADD CONSTRAINT "platform_site_diagnostics_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "platform_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
