/*
 * Kassa pulini uzatish (kuryer -> kassir) qulflar ostida bo'lishi.
 *
 * TUZATILGAN XATO. `createCashTransfer` kuryer smenasini qulflamasdan
 * balansni o'qirdi va "yetarlimi" deb tekshirardi. PostgreSQL sukut
 * bo'yicha READ COMMITTED da ishlaydi va `findFirst` qulflamaydi, ya'ni
 * bir kuryerdan kelgan ikkita so'rov (tugmani ikki marta bosish yoki
 * ikkinchi qurilma) BIR XIL balansni o'qib, ikkalasi ham tekshiruvdan
 * o'tardi va ikkalasi ham `CASH_OUT` yozardi. Natija: kuryer o'zida
 * borkidan ikki barobar ko'p topshirgan bo'lib ko'rinardi va smena
 * balansi minusga tushardi.
 *
 * Bunday xato test bilan tutilmaydi va faqat kassa hisobi farq qilganda
 * bilinadi — shuning uchun manba darajasida qulflandi.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const shifts = read("apps/backend/src/modules/shifts/shifts.service.ts");

/*
 * `\r?\n` ATAYLAB: repo Windows'da CRLF bilan tekshirib olinadi va
 * faqat `\n` kutadigan regex jimgina hech narsa topmay, tekshiruvni
 * bo'sh o'tkazib yuborardi.
 */
function methodBody(name: string): string {
  const body = shifts.match(
    new RegExp(`async ${name}\\([\\s\\S]*?\\r?\\n {2}\\}\\r?\\n`),
  )?.[0];
  assert.ok(body, `${name} topilmadi.`);
  return body;
}

/*
 * BAJARILADIGAN SQL'ni talab qiladi, matnni emas.
 *
 * Ilgari bu yerda oddiy `/FOR UPDATE/` turardi va u IZOHGA ham mos
 * kelardi: qulf kodi olib tashlanganda ham, uni tushuntiruvchi izoh
 * qolgani uchun validator o'tib ketardi. Yolg'on ijobiy xatodan ham
 * yomon — u himoya bor degan ishonch beradi.
 */
function assertRowLock(body: string, table: string, label: string): void {
  assert.match(
    body,
    new RegExp(
      // `$queryRawUnsafe<{ id: string }[]>(...)` — generik ixtiyoriy.
      `\\$queryRawUnsafe(?:<[^>]*>)?\\([\\s\\S]{0,160}FROM "${table}"[\\s\\S]{0,80}FOR UPDATE`,
    ),
    label,
  );
}

/*
 * PUL CHIQISHI. Balansni o'qishdan OLDIN smena qatori qulflanishi shart,
 * aks holda ikkita bir vaqtdagi topshirish bir xil balansni ko'radi.
 */
const create = methodBody("createCashTransfer");
assertRowLock(
  create,
  "shifts",
  "createCashTransfer smenani qulflamayapti — ikkita bir vaqtdagi topshirish balansni ikki marta sarflardi.",
);
const lockAt = create.indexOf("$queryRawUnsafe");
const readAt = create.indexOf("cashTransaction.findMany");
assert.ok(readAt !== -1, "createCashTransfer balansni o'qimayapti.");
assert.ok(
  lockAt < readAt,
  "Qulf balansni o'qishdan KEYIN olinyapti — poyga ochiq qoladi.",
);
assert.match(
  create,
  /balance\.lessThan\(amount\)/,
  "Topshiriladigan summa balansga taqqoslanmayapti.",
);

/*
 * PUL KIRISHI. Qabul qilishda uzatma qatori qulflanishi shart, aks holda
 * bitta uzatma ikki marta qabul qilinib, kassaga ikki barobar pul
 * yozilardi.
 */
const accept = methodBody("acceptCashTransfer");
assertRowLock(
  accept,
  "cash_transfers",
  "acceptCashTransfer uzatmani qulflamayapti — bitta uzatma ikki marta qabul qilinishi mumkin.",
);
assert.match(
  accept,
  /transfer\.status !== CashTransferStatus\.PENDING/,
  "Qabul qilingan uzatma qayta qabul qilinishi mumkin.",
);
assert.match(
  accept,
  /transfer\.branchId !== cashierShift\.branchId/,
  "Boshqa filialning uzatmasi qabul qilinishi mumkin.",
);

/*
 * Rad etish ham bir marta bo'lishi kerak: qulfsiz uzatma ham qabul,
 * ham rad etilgan holatga tushishi mumkin edi.
 */
const reject = methodBody("rejectCashTransfer");
assertRowLock(
  reject,
  "cash_transfers",
  "rejectCashTransfer uzatmani qulflamayapti.",
);

console.log("Kassa pulini uzatish validatsiyasi o'tdi");
