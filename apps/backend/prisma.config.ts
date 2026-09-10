import { defineConfig, env } from "prisma/config";
import { loadEnvironmentFile } from "./src/config/env";

/*
 * Prisma CLI ham `.env` ni O'ZI YUKLAMAYDI (7-bosqich Q3.1 bilan bir xil
 * muammo). Yuklanmasa `prisma validate`, `migrate` va `generate`
 * "Cannot resolve environment variable: DATABASE_URL" bilan to'xtaydi —
 * xabar sxemada nuqson bordek ko'rinadi, aslida esa fayl o'qilmagan.
 */
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
