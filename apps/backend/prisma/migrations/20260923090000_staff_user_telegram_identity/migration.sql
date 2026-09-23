ALTER TABLE "users" ADD COLUMN "telegramUserId" TEXT;

UPDATE "users" AS u
SET "telegramUserId" = e."telegramUserId"
FROM "employees" AS e
WHERE e."userId" = u."id"
  AND e."telegramUserId" IS NOT NULL;

CREATE UNIQUE INDEX "users_telegramUserId_key" ON "users"("telegramUserId");
