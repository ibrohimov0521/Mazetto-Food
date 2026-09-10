/*
 * API javob KONVERTI uchala tomonda bir xil tushunilishi (6.2).
 *
 * TUZATILGAN XATO. Backend `ValidationPipe` har buzilgan maydon uchun
 * alohida satr beradi va `HttpExceptionFilter` ularni MASSIV holida
 * uzatadi. `customer-web` buni to'g'ri o'qirdi, `pos-web` esa tipida
 * `message: string` deb yozgan edi — TypeScript xavfsiz deb hisoblardi,
 * `new Error(massiv)` esa xabarlarni vergul bilan BO'SHLIQSIZ
 * yopishtirib yuborardi va admin o'qib bo'lmaydigan matn ko'rardi.
 *
 * NIMA UCHUN UMUMIY PAKET EMAS. Ikkala `apiFetch` ATAYLAB boshqacha:
 * biri xodim sessiyasi bilan ishlaydi va 401 da tokenni yangilaydi,
 * ikkinchisi mijoz tokenini parametr sifatida oladi va katalogni
 * keshlaydi. Ularni bitta paketga yig'ish har ikkalasiga ham keraksiz
 * maydonlar qo'shardi. Umumiy narsa — atigi konvert SHAKLI, va u shu
 * skript bilan qulflanadi.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const filter = read(
  "apps/backend/src/common/filters/http-exception.filter.ts",
);
const posApi = read("apps/pos-web/lib/api.ts");
const customerApi = read("apps/customer-web/lib/api.ts");

/*
 * Manba: backend `message` ni massiv sifatida ham uzatadi. Bu shart
 * o'zgarsa, quyidagi ikkala mijoz ham qayta ko'rib chiqilishi kerak.
 */
assert.match(
  filter,
  /message\?: string \| string\[\];/,
  "Backend konverti `string[]` ni e'lon qilmayapti — mijozlardagi ishlov keraksiz bo'lib qoladi.",
);

// Ikkala mijoz ham massiv ehtimolini TIPDA tan olishi shart.
for (const [name, source] of [
  ["pos-web", posApi],
  ["customer-web", customerApi],
] as const) {
  assert.match(
    source,
    /error\?: \{ message: string \| string\[\] \}/,
    `${name} konvert tipida "string[]" yo'q — TypeScript yolg'on xavfsizlik beradi.`,
  );
  assert.match(
    source,
    /Array\.isArray\([\s\S]{0,60}\.join\(", "\)/,
    `${name} massiv xabarni o'qiladigan qilib birlashtirmayapti.`,
  );
}

console.log("API konverti validatsiyasi o'tdi");
