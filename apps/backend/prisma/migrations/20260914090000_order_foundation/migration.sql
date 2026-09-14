ALTER TABLE "orders"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "audit_logs"
ADD COLUMN "reasonCode" TEXT,
ADD COLUMN "correlationId" TEXT;

CREATE INDEX "audit_logs_correlationId_idx"
ON "audit_logs"("correlationId");

CREATE TYPE "IdempotencyRequestStatus" AS ENUM (
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "idempotency_requests" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" "IdempotencyRequestStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "correlationId" TEXT NOT NULL,
  "actorId" TEXT,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "failureCode" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "idempotency_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_requests_scope_key_key"
ON "idempotency_requests"("scope", "key");

CREATE INDEX "idempotency_requests_status_expiresAt_idx"
ON "idempotency_requests"("status", "expiresAt");

CREATE INDEX "idempotency_requests_correlationId_idx"
ON "idempotency_requests"("correlationId");

CREATE INDEX "idempotency_requests_resourceType_resourceId_idx"
ON "idempotency_requests"("resourceType", "resourceId");
