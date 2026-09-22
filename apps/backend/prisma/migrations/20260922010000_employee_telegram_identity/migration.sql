ALTER TABLE "employees"
ADD COLUMN "telegramUserId" TEXT;

CREATE UNIQUE INDEX "employees_telegramUserId_key"
ON "employees"("telegramUserId");
