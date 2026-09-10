/*
 * Yuborilmagan bildirishnomalar (Q6).
 *
 * Bu yerdagi shartlar buzilsa hech narsa qulamaydi — bildirishnoma
 * yana JIMGINA yo'qola boshlaydi, va buni faqat mijoz qo'ng'iroq
 * qilganda bilib qolamiz.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const service = read(
  "apps/backend/src/modules/notifications/notification-dead-letter.service.ts",
);
const controller = read(
  "apps/backend/src/modules/notifications/notifications.controller.ts",
);
const telegram = read(
  "apps/backend/src/modules/telegram/telegram-order-notification.service.ts",
);
const appModule = read("apps/backend/src/app.module.ts");
const permissions = read("apps/backend/src/common/auth/permissions.ts");

assert.match(appModule, /NotificationsModule/, "Modul ulanmagan.");
assert.match(
  permissions,
  /NOTIFICATION_MANAGE: "NOTIFICATION_MANAGE"/,
  "NOTIFICATION_MANAGE permissioni yo'q.",
);

/*
 * ENG MUHIM SHART. Ilgari `catch` bloki xatoni logga yozib, bildirishnomani
 * TASHLAB YUBORARDI. Har ikkala yo'l ham yozuv qoldirishi kerak.
 */
for (const kind of ["staff_new_order", "staff_status_refresh"]) {
  assert.match(
    telegram,
    new RegExp(`deadLetters\\.record\\(\\{[\\s\\S]{0,80}kind: "${kind}"`),
    `"${kind}" yo'lida yo'qotish yozib olinmayapti.`,
  );
}
/*
 * Yozuv `catch` ICHIDA bo'lishi kerak — muvaffaqiyatli yo'lda emas.
 * Aks holda har bildirishnoma o'lik xat sifatida yozilardi.
 */
const sendBody =
  telegram.match(/private async sendNewOrder\([\s\S]*?\n {2}\/\*\*/)?.[0] ?? "";
assert.ok(sendBody, "sendNewOrder topilmadi.");
const catchAt = sendBody.indexOf("} catch (error) {");
const recordAt = sendBody.indexOf("deadLetters.record(");
assert.ok(catchAt !== -1 && recordAt !== -1);
assert.ok(
  catchAt < recordAt,
  "O'lik xat `catch` dan tashqarida yozilyapti — har bildirishnoma xato deb qayd etilardi.",
);

// --- Chegara ---
assert.match(
  service,
  /MAX_ENTRIES = 500/,
  "Ro'yxat chegarasi yo'q — Redis uzoq tushganda xotira to'lib ketardi.",
);
assert.match(
  service,
  /\.ltrim\(REDIS_KEY, 0, MAX_ENTRIES - 1\)/,
  "Redis ro'yxati LTRIM bilan chegaralanmayapti.",
);
/*
 * `LPUSH` va `LTRIM` bitta pipeline'da bo'lishi kerak: orasida uzilish
 * bo'lsa ro'yxat chegaradan oshib ketardi.
 */
assert.match(
  service,
  /\.pipeline\(\)[\s\S]{0,120}\.lpush\([\s\S]{0,120}\.ltrim\(/,
  "LPUSH va LTRIM bitta pipeline'da emas.",
);

/*
 * `LREM` indeks bo'yicha emas, SATR bo'yicha o'chirishi kerak: o'qish va
 * o'chirish orasida yangi yozuv qo'shilsa indeks siljib, BOSHQA yozuv
 * o'chib ketardi.
 */
assert.match(
  service,
  /\.lrem\(REDIS_KEY, 1, row\)/,
  "O'chirish satr bo'yicha emas — noto'g'ri yozuv o'chishi mumkin.",
);

// Redis yo'q bo'lsa ham yo'qotish ko'rinishi kerak.
assert.match(
  service,
  /private readonly fallback: DeadLetter\[\]/,
  "Redis yo'q holatida zaxira ro'yxat yo'q.",
);
assert.match(
  service,
  /this\.fallback\.length = MAX_ENTRIES/,
  "Zaxira ro'yxat chegaralanmagan.",
);

// --- Idempotency ---
assert.match(
  service,
  /messageId: randomUUID\(\)/,
  "messageId UUID emas — qayta yuborishda noto'g'ri yozuv o'chishi mumkin.",
);

// --- Qayta yuborish ---
const retryBody =
  telegram.match(/async retryDeadLetter\([\s\S]*?\n {2}private /)?.[0] ?? "";
assert.ok(retryBody, "retryDeadLetter topilmadi.");
/*
 * Holat yangilanishi qayta yuborilmaydi: u o'tib ketgan KITCHEN hodisasiga
 * bog'liq va uni qayta o'ynatish hozirgi holatni eskirgani bilan
 * almashtirib qo'yardi.
 */
assert.match(
  retryBody,
  /entry\.kind !== "staff_new_order"/,
  "Holat yangilanishi ham qayta yuborilyapti — eskirgan holat yoziladi.",
);

// Qayta yuborish TASHQI xabar jo'natadi, ya'ni GET bo'lmasligi kerak.
assert.match(
  controller,
  /@Post\("dead-letters\/:messageId\/retry"\)/,
  "Qayta yuborish POST emas — brauzer prefetch'i uni ishga tushirishi mumkin.",
);
for (const guard of ["list", "retry"]) {
  assert.match(
    controller,
    new RegExp(
      `PERMISSIONS\\.NOTIFICATION_MANAGE\\)[\\s\\S]{0,200}${guard}\\(`,
    ),
    `"${guard}" NOTIFICATION_MANAGE bilan himoyalanmagan.`,
  );
}

console.log("Bildirishnoma o'lik xatlari validatsiyasi o'tdi");
