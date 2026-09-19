ALTER TABLE "devices"
  ADD COLUMN "hardwareId" TEXT;

UPDATE "devices"
SET "hardwareId" = "id"
WHERE "enrolledAt" IS NOT NULL
  AND "hardwareId" IS NULL;

CREATE UNIQUE INDEX "devices_hardwareId_key"
  ON "devices"("hardwareId");