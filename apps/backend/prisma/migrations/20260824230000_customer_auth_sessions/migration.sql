CREATE TABLE "customer_verification_challenges" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_verification_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_sessions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_verification_challenges_phone_createdAt_idx" ON "customer_verification_challenges"("phone", "createdAt");
CREATE INDEX "customer_verification_challenges_phone_consumedAt_expiresAt_idx" ON "customer_verification_challenges"("phone", "consumedAt", "expiresAt");
CREATE INDEX "customer_verification_challenges_customerId_idx" ON "customer_verification_challenges"("customerId");

CREATE INDEX "customer_sessions_customerId_idx" ON "customer_sessions"("customerId");
CREATE INDEX "customer_sessions_expiresAt_idx" ON "customer_sessions"("expiresAt");
CREATE INDEX "customer_sessions_revokedAt_idx" ON "customer_sessions"("revokedAt");

ALTER TABLE "customer_verification_challenges" ADD CONSTRAINT "customer_verification_challenges_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
