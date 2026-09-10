-- Ish vaqtida o'zgartiriladigan biznes sozlamalari (7-bosqich Q1).
--
-- Ilgari bunday jadval yo'q edi: biznes konstantalari kodda qattiq yozilgan
-- va har o'zgarish redeploy talab qilardi.

CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "settings_isPublic_idx" ON "settings"("isPublic");

-- Sozlamani o'zgartirgan xodim o'chirilsa yozuv saqlanadi, faqat havola
-- bo'shatiladi — sozlamaning o'zi biznes qiymati.
ALTER TABLE "settings"
    ADD CONSTRAINT "settings_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
