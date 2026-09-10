/*
 * Repo BUNDAN KEYIN og'irlashmasin (6.7).
 *
 * NIMA UCHUN TARIXNI QAYTA YOZMADIK. `.git` 237 MB va uning katta qismi
 * tarixdagi dizayn manbalari (46 MB `.cdr`, 8.7 MB PDF, rasm nusxalari).
 * Ularni tarixdan chiqarish `git filter-repo` talab qiladi: har commit
 * SHA'si o'zgaradi, `main` ga force-push kerak bo'ladi va HAMMA reponi
 * qaytadan klon qilishi shart — yo'ldagi shoxlar uziladi.
 *
 * O'LCHANDI: bu og'irlik amalda deyarli hech narsaga turmaydi.
 *   - `.dockerignore` `.git` ni chiqaradi, ya'ni Docker build tarixni
 *     umuman ko'chirmaydi.
 *   - `actions/checkout@v4` sukut bo'yicha SAYOZ klon qiladi
 *     (`fetch-depth: 1`), ya'ni CI ham to'liq tarixni tortmaydi.
 * Qoladigan narxi — dasturchining bir martalik to'liq kloni.
 *
 * Shuning uchun tarix TEGILMADI, lekin o'sish to'xtatildi: bu skript
 * ro'yxatdan TASHQARI yangi og'ir fayl qo'shilsa yiqiladi.
 *
 * Yangi katta ikkilik fayl kerak bo'lsa: uni repoga qo'shmang. Dizayn
 * manbalari umumiy diskda, media esa MinIO'da turishi kerak (3.6).
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Shundan og'ir fayl ataylab qo'shilgan bo'lishi kerak. */
const LIMIT_KB = 512;

/*
 * MAVJUD og'ir fayllar — ular tarixda allaqachon bor va ularni endi
 * o'chirish repo hajmiga ta'sir qilmaydi (tarix baribir saqlaydi).
 * Ro'yxat O'SMASLIGI kerak.
 */
const GRANDFATHERED = new Set([
  "docs/design/source-media/menu mazetto.cdr",
  "docs/design/source-media/menu mazetto.pdf",
  "docs/design/references/00_mazetto-food-logo-4k-transparent.png",
  "docs/design/references/00_mazetto-food-logo-web-2048.webp",
  "docs/design/references/01_home-reference.png",
  "docs/design/references/02_menu-reference.png",
  "docs/design/references/03_product-detail-reference.png",
  "docs/design/references/04_cart-checkout-reference.png",
  "docs/design/references/05_profile-orders-telegram-reference.png",
  "apps/customer-web/public/brand/mazetto-m-icon.png",
  "apps/customer-web/public/brand/mazetto-food-logo.webp",
]);

const tracked = execFileSync("git", ["ls-files"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
})
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const offenders: string[] = [];

for (const file of tracked) {
  if (GRANDFATHERED.has(file)) continue;

  let sizeKb: number;
  try {
    sizeKb = Math.round(statSync(join(root, file)).size / 1024);
  } catch {
    // Fayl ish daraxtida yo'q (masalan submodule) — o'tkazamiz.
    continue;
  }

  if (sizeKb > LIMIT_KB) {
    offenders.push(`${sizeKb}K  ${file}`);
  }
}

assert.deepEqual(
  offenders,
  [],
  `Repoga ${LIMIT_KB}K dan og'ir yangi fayl qo'shilgan:\n  ` +
    offenders.join("\n  ") +
    "\n\nIkkilik fayllar repoda saqlanmaydi: dizayn manbalari umumiy " +
    "diskda, mahsulot rasmlari MinIO'da. Fayl haqiqatan kerak bo'lsa, " +
    "uni shu skriptdagi ro'yxatga ataylab qo'shing.",
);

/*
 * Ro'yxat ham O'SMASLIGI kerak: har yangi yozuv reponi doimiy
 * og'irlashtiradi va bu qaror ko'rinib turishi shart.
 */
assert.ok(
  GRANDFATHERED.size <= 11,
  `Grandfathered ro'yxati ${GRANDFATHERED.size} taga o'sdi — har yangi ` +
    "yozuv reponi abadiy og'irlashtiradi.",
);

console.log(
  `Repo og'irligi validatsiyasi o'tdi (${tracked.length} fayl, chegara ${LIMIT_KB}K)`,
);
