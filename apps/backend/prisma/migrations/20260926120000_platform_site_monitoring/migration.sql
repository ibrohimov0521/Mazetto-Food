CREATE TABLE "platform_sites" (
    "id" TEXT NOT NULL,
    "siteKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productCode" TEXT NOT NULL DEFAULT 'MAZETTO_FOOD',
    "websiteUrl" TEXT NOT NULL,
    "apiHealthUrl" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastHeartbeatStatus" TEXT,
    "lastHeartbeatData" JSONB,
    "websiteStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "websiteStatusCode" INTEGER,
    "websiteLatencyMs" INTEGER,
    "websiteCheckedAt" TIMESTAMP(3),
    "websiteError" TEXT,
    "apiStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "apiStatusCode" INTEGER,
    "apiLatencyMs" INTEGER,
    "apiCheckedAt" TIMESTAMP(3),
    "apiError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_site_events" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchName" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_site_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_sites_siteKey_key" ON "platform_sites"("siteKey");
CREATE UNIQUE INDEX "platform_sites_tokenHash_key" ON "platform_sites"("tokenHash");
CREATE INDEX "platform_sites_isActive_lastHeartbeatAt_idx" ON "platform_sites"("isActive", "lastHeartbeatAt");
CREATE INDEX "platform_sites_websiteStatus_apiStatus_idx" ON "platform_sites"("websiteStatus", "apiStatus");
CREATE UNIQUE INDEX "platform_site_events_siteId_externalId_key" ON "platform_site_events"("siteId", "externalId");
CREATE INDEX "platform_site_events_siteId_occurredAt_idx" ON "platform_site_events"("siteId", "occurredAt");

ALTER TABLE "platform_site_events"
ADD CONSTRAINT "platform_site_events_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "platform_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
