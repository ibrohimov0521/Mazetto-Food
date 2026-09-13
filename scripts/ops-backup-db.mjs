#!/usr/bin/env node
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  createReadStream,
  createWriteStream,
  mkdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";

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
  .replace(/[-:.]/g, "")
  .replace("T", "-")
  .replace("Z", "");
const target = join(outDir, `mazetto-${stamp}.dump`);
const partial = `${target}.partial`;

mkdirSync(outDir, { recursive: true });

console.log(`Baza: ${database} (konteyner ${container})`);

// `-Fc` — maxsus format: `pg_restore` uni o'qiy oladi va tanlab tiklash
// mumkin. Oddiy SQL dump'da `--list` tekshiruvi ishlamaydi.
const dump = spawn(
  "docker",
  ["exec", container, "pg_dump", "-U", user, "-d", database, "-Fc"],
  { stdio: ["ignore", "pipe", "ignore"] },
);
const [[dumpCode]] = await Promise.all([
  once(dump, "close"),
  pipeline(
    dump.stdout,
    createWriteStream(partial, { flags: "wx", mode: 0o600 }),
  ),
]);
if (dumpCode !== 0) {
  throw new Error("pg_dump bajarilmadi — backup dalili yangilanmadi");
}

const size = statSync(partial).size;

if (size === 0) {
  console.error("Dump BO'SH — backup yaroqsiz");
  process.exit(1);
}

try {
  const restore = spawn(
    "docker",
    ["exec", "-i", container, "pg_restore", "--list"],
    { stdio: ["pipe", "pipe", "ignore"] },
  );
  let entries = 0;
  const countEntries = (async () => {
    for await (const line of createInterface({ input: restore.stdout })) {
      if (line && !line.startsWith(";")) entries += 1;
    }
  })();
  const [[restoreCode]] = await Promise.all([
    once(restore, "close"),
    pipeline(createReadStream(partial), restore.stdin),
    countEntries,
  ]);
  if (restoreCode !== 0 || entries === 0) {
    throw new Error("pg_restore arxivida yozuvlar yo'q");
  }
  renameSync(partial, target);
  const statusFile = join(outDir, "latest-verified.json");
  const statusPartial = `${statusFile}.${stamp}.partial`;
  writeFileSync(
    statusPartial,
    JSON.stringify({
      version: 1,
      verifiedAt: new Date().toISOString(),
      archiveName: `mazetto-${stamp}.dump`,
      bytes: size,
      archiveEntries: entries,
      verification: "pg_restore_list",
    }),
    { flag: "wx", mode: 0o600 },
  );
  renameSync(statusPartial, statusFile);
  console.log(`Yozildi: ${target} (${size.toLocaleString("en-US")} bayt)`);
  console.log(`Arxiv o'qildi — ${entries} ta yozuv. Backup yaroqli.`);
} catch (error) {
  console.error("BACKUP YAROQSIZ — pg_restore arxivni o'qiy olmadi");
  process.exit(1);
}
