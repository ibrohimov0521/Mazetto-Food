ALTER TABLE "devices"
ADD COLUMN IF NOT EXISTS "deviceAuthTokenHash" TEXT;
