ALTER TABLE "devices"
  ADD COLUMN "enrollmentCodeHash" TEXT,
  ADD COLUMN "enrollmentExpiresAt" TIMESTAMP(3),
  ADD COLUMN "enrolledAt" TIMESTAMP(3);

CREATE INDEX "devices_enrollmentExpiresAt_idx"
  ON "devices"("enrollmentExpiresAt");
