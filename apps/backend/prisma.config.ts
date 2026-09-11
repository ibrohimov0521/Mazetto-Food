import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { defineConfig, env } from "prisma/config";

/*
 * Prisma CLI `.env` ni O'ZI YUKLAMAYDI (7-bosqich Q3.1 bilan bir xil muammo).
 * Yuklanmasa `prisma validate`, `migrate` va `generate` "Cannot resolve
 * environment variable: DATABASE_URL" bilan to'xtaydi — xabar sxemada nuqson
 * bordek ko'rinadi, aslida esa fayl o'qilmagan.
 *
 * Yuklovchi ATAYLAB shu yerda takrorlangan va `src/` dan HECH NARSA import
 * qilinmaydi. Ilgari bu fayl `./src/config/env` ni olardi; ishlab chiqarish
 * image'iga esa faqat `dist` ko'chiriladi, `src` yo'q. Natijada production
 * konteynerida HAR QANDAY prisma buyrug'i
 *
 *   Failed to load config file "/app/apps/backend/prisma.config.ts"
 *   Error: Cannot find module './src/config/env'
 *
 * bilan yiqilardi, ya'ni hujjatda yozilgan `prisma migrate deploy` aynan
 * kerak bo'lgan joyda ishlamasdi (2026-09-11 da aniqlandi). Sxemada
 * `datasource.url` yo'q, ya'ni configsiz ham bo'lmaydi — shuning uchun config
 * har qanday muhitda yuklanishi shart.
 */
function loadEnvironmentFile(startDir = process.cwd()): void {
  let current = resolve(startDir);

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(current, ".env");

    if (existsSync(candidate)) {
      try {
        process.loadEnvFile(candidate);
      } catch {
        // Buzuq fayl buyruqni to'xtatmaydi: yetishmagan qiymatni quyidagi
        // `env()` o'zi aytadi.
      }

      return;
    }

    const parent = dirname(current);

    if (parent === current) {
      return;
    }

    current = parent;
  }
}

// Konteynerda `.env` umuman bo'lmaydi — qiymatlar Docker orqali keladi va bu
// chaqiruv shunchaki hech narsa qilmaydi.
loadEnvironmentFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
