#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Baza nusxasini olish va YAROQLILIGINI tekshirish (7-bosqich Q3.3).
 *
 * `MAZETTO_RELEASE_READINESS_CHECKLIST.md` ning 2-bosqichi har reliz oldidan
 * backup VA `pg_restore --list` bilan tekshiruvni talab qiladi. Ikkalasi ham
 * qo'lda terilardi, qo'lda teriladigan zerikarli qadam esa vaqti kelib
 * o'tkazib yuboriladi.
 *
 * Tekshiruv ATAYLAB shu yerda: o'qib bo'lmaydigan dump — backup emas, va buni
 * tiklash kerak bo'lgan kunda bilish juda kech.
 */

const container = process.env.MAZETTO_PG_CONTAINER ?? "mazetto-postgres";
const outDir = process.env.MAZETTO_BACKUP_DIR ?? ".backups";

function envValue(name, fallback) {
  return process.env[name]?.trim() || fallback;
}

const user = envValue("POSTGRES_USER", "mazetto");
const database = envValue("POSTGRES_DB", "mazetto");

const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..+/, "")
  .replace("T", "-");
const target = join(outDir, `mazetto-${stamp}.dump`);

mkdirSync(outDir, { recursive: true });

console.log(`Baza: ${database} (konteyner ${container})`);

// `-Fc` — maxsus format: `pg_restore` uni o'qiy oladi va tanlab tiklash
// mumkin. Oddiy SQL dump'da `--list` tekshiruvi ishlamaydi.
const dump = execFileSync(
  "docker",
  ["exec", container, "pg_dump", "-U", user, "-d", database, "-Fc"],
  { maxBuffer: 1024 * 1024 * 512 },
);

writeFileSync(target, dump);
const size = statSync(target).size;
console.log(`Yozildi: ${target} (${size.toLocaleString("en-US")} bayt)`);

if (size === 0) {
  console.error("Dump BO'SH — backup yaroqsiz");
  process.exit(1);
}

try {
  const listing = execFileSync(
    "docker",
    ["exec", "-i", container, "pg_restore", "--list"],
    { input: dump, maxBuffer: 1024 * 1024 * 128 },
  ).toString();

  const entries = listing.split("\n").filter((line) => line && !line.startsWith(";")).length;
  console.log(`Arxiv o'qildi — ${entries} ta yozuv. Backup yaroqli.`);
} catch (error) {
  console.error("BACKUP YAROQSIZ — pg_restore arxivni o'qiy olmadi");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
