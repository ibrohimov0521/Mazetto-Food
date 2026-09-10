import * as assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

/*
 * Rasm yuklash xavfsizligi (7-bosqich Q4).
 *
 * Bu yo'l tashqi fayl qabul qiladi, ya'ni uning chegaralari kod bilan birga
 * saqlanishi kerak. Har biri alohida hujum yo'lini yopadi.
 */

const minio = readSource("apps/backend/src/modules/uploads/minio.service.ts");
const controller = readSource("apps/backend/src/modules/uploads/uploads.controller.ts");
const compose = readSource("docker-compose.yml");

// --- Kirish tekshiruvi ---------------------------------------------------

// Tur oq ro'yxat bo'yicha: `image/*` kabi keng naqsh SVG'ni ham o'tkazardi
// va u ichida skript olib yurishi mumkin.
assert.match(controller, /new FileTypeValidator\(/);
assert.match(minio, /"image\/png": "png"/);
assert.match(minio, /"image\/jpeg": "jpg"/);
assert.doesNotMatch(minio, /image\/svg/);

// Hajm IKKI joyda cheklanadi: interceptor oqimni to'xtatadi, validator esa
// o'tib ketganini rad etadi.
assert.match(controller, /limits: \{ fileSize: MAX_IMAGE_BYTES \}/);
assert.match(controller, /new MaxFileSizeValidator\(\{ maxSize: MAX_IMAGE_BYTES \}\)/);
assert.match(minio, /MAX_IMAGE_BYTES = 5 \* 1024 \* 1024/);

// Yuklash — katalogni tahrirlashning bir qismi, ochiq endpoint emas.
assert.match(controller, /@Permissions\(PERMISSIONS\.MENU_EDIT\)/);

// --- Nom va joylashuv ----------------------------------------------------

/*
 * Fayl nomi UUID dan, YUKLANGAN NOMDAN EMAS.
 *
 * Original nom boshqa fayl ustiga yozishi, yo'l belgilarini olib kirishi
 * yoki mijozning shaxsiy ma'lumotini ochib qo'yishi mumkin.
 */
assert.match(minio, /randomUUID\(\)/);
assert.doesNotMatch(minio, /file\.originalname/);

// Kengaytma TEKSHIRILGAN MIME dan olinadi, fayl nomidan emas.
assert.match(minio, /EXTENSION_BY_MIME\[file\.mimetype\]/);

/*
 * Papka nomi mijozdan keladi — oq ro'yxat SHART.
 *
 * Aks holda `../` bilan bucket ichida boshqa joyga yozish mumkin bo'lardi.
 */
assert.match(
  controller,
  /folder === "categories" \|\| folder === "homepage" \? folder : "products"/,
);

// --- Saqlash qatlami -----------------------------------------------------

// Bucket anonim O'QISH uchun ochiq (rasmlar mijoz saytida ko'rinadi), lekin
// YOZISH faqat backend kalitlari bilan.
assert.match(minio, /"s3:GetObject"/);
assert.doesNotMatch(minio, /s3:PutObject/);

// Fayl nomi UUID, ya'ni mazmuni o'zgarmaydi — uzoq kesh xavfsiz.
assert.match(minio, /max-age=31536000, immutable/);

// Sozlanmagan bo'lsa ilova ISHLAYVERADI, faqat yuklash o'chiq bo'ladi.
assert.match(minio, /MinIO sozlanmagan/);
assert.match(minio, /this\.client = null/);

// --- Infratuzilma --------------------------------------------------------

assert.match(compose, /container_name: mazetto-minio/);
// Portlar env orqali: bu mashinada 9000 boshqa loyiha tomonidan egallangan.
assert.match(compose, /\$\{MINIO_PORT:-9000\}:9000/);
assert.match(compose, /minio-data:\/data/);

console.log("Media upload validation passed");

function readSource(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8").replace(/\r/g, "");
}

function findRepoRoot(startPath: string): string {
  let current = startPath;

  for (let depth = 0; depth < 8; depth += 1) {
    const packageJsonPath = join(current, "package.json");

    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        name?: string;
      };

      if (packageJson.name === "mazetto-food") {
        return current;
      }
    }

    const parent = dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  throw new Error("Could not locate mazetto-food repository root");
}
