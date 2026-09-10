/*
 * Taqdimot qatlamining AJRATILGANLIGI (6.6).
 *
 * Ajratish faqat modul SOF qolgandagina foyda beradi. Unga bitta
 * `this.prisma` yoki `fetch` kirsa, u yana sinab bo'lmaydigan holatga
 * qaytadi va fayl asta-sekin eski hajmiga o'sib boradi.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const presentation = read(
  "apps/backend/src/modules/telegram/telegram-customer-presentation.ts",
);
const service = read(
  "apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts",
);

/*
 * SOFLIK. `this` yo'q, ya'ni klass ham, holat ham yo'q. Bu funksiyalarni
 * hech qanday tayyorgarliksiz chaqirib sinash mumkinligini kafolatlaydi.
 */
assert.doesNotMatch(
  presentation,
  /\bthis\./,
  "Taqdimot moduliga `this` kirib qolgan — u endi sof emas.",
);
/*
 * `@prisma/client` dan TIP import qilish ruxsat: `Prisma.Decimal` va
 * `Prisma.JsonValue` shunchaki tiplar, baza bog'liqligi emas. Taqiqlangani
 * — bazaga yoki tarmoqqa haqiqiy murojaat.
 */
for (const [forbidden, why] of [
  ["PrismaService", "baza servisi"],
  ["prisma.", "baza mijozi"],
  ["fetch(", "tarmoq so'rovi"],
  ["@Injectable", "Nest provayderi"],
  ["Logger", "servis holati"],
] as const) {
  assert.ok(
    !presentation.includes(forbidden),
    `Taqdimot modulida "${forbidden}" (${why}) bor — u faqat sof funksiyalar uchun.`,
  );
}

/*
 * Servis endi bu funksiyalarni O'ZIDA saqlamasligi kerak. Nusxa paydo
 * bo'lsa, ikkalasi jimgina ajralib ketardi.
 */
for (const name of [
  "categoryButtonLabel",
  "telegramProductButtonLabel",
  "escapeHtml",
  "maskPhone",
  "formatMoney",
  "cleanAddress",
  "readCartModifiers",
  "branchMapUrl",
  "chunkButtons",
  "parseCustomerOrderType",
  "branchSupportsType",
  "isSimpleQuickAddProduct",
  "isMessageNotModifiedError",
  "requiredTelegramId",
]) {
  assert.ok(
    presentation.includes(`export function ${name}`),
    `"${name}" taqdimot modulida yo'q.`,
  );
  assert.ok(
    !new RegExp(`^  (private )?${name}\\(`, "m").test(service),
    `"${name}" servisda QAYTA paydo bo'lgan — ikki nusxa ajralib ketadi.`,
  );
  assert.ok(
    !service.includes(`this.${name}(`),
    `Servis hamon \`this.${name}(\` ni chaqiryapti.`,
  );
}

// Menyu joylashuvi ham taqdimot ma'lumoti.
for (const rows of ["lavashTelegramRows", "burgerTelegramRows"]) {
  assert.ok(
    presentation.includes(`export const ${rows}`),
    `"${rows}" taqdimot modulida yo'q.`,
  );
  assert.ok(
    !new RegExp(`^const ${rows} =`, "m").test(service),
    `"${rows}" servisda qayta e'lon qilingan.`,
  );
}

/*
 * Fayl yana o'sib ketmasin. Chegara hozirgi hajmdan biroz yuqori:
 * maqsad o'sishni TAQIQLASH emas, sezdirmay ikki ming qatorga qaytishni
 * to'sish. Bu chegaraga tegilsa, keyingi bo'lakni ajratish vaqti kelgan.
 */
const serviceLines = service.split("\n").length;
assert.ok(
  serviceLines < 1250,
  `Servis ${serviceLines} qatorga o'sdi (chegara 1250). Keyingi bo'lakni ajrating.`,
);

/*
 * QATLAM TARTIBI. Har qatlam faqat PASTGA qarashi kerak:
 *
 *   buyurtma -> checkout -> (sessiya, savat, ekran)
 *   savat -> ekran
 *   ekran -> hech kim
 *
 * Halqa bog'liqlik Nest'da `forwardRef` talab qiladi va u ishga tushish
 * tartibiga bog'liq nozik nosozliklar keltiradi — aynan shu sabab
 * qatlamlar shu tartibda ajratilgan edi.
 */
const screen = read(
  "apps/backend/src/modules/telegram/telegram-customer-screen.service.ts",
);
const checkout = read(
  "apps/backend/src/modules/telegram/telegram-checkout.service.ts",
);
const cart = read("apps/backend/src/modules/telegram/telegram-cart.service.ts");

assert.doesNotMatch(
  screen,
  /from "\.\/telegram-(cart|checkout|customer-ordering)/,
  "Ekran qatlami yuqoriga bog'landi — halqa yuzaga keladi.",
);
assert.doesNotMatch(
  cart,
  /from "\.\/telegram-(checkout|customer-ordering)/,
  "Savat qatlami yuqoriga bog'landi — halqa yuzaga keladi.",
);
assert.doesNotMatch(
  checkout,
  /from "\.\/telegram-customer-ordering/,
  "Checkout buyurtma servisiga bog'landi — halqa yuzaga keladi.",
);

/*
 * Checkout oqimi buyurtma servisiga QAYTIB kelmasin: bu metodlar bitta
 * ketma-ketlik va bo'linib ketsa, sessiya holati ikki joyda
 * boshqarilardi.
 */
for (const name of [
  "startCheckout",
  "selectOrderType",
  "acceptDeliveryAddress",
  "sendCheckoutSummary",
  "confirmCartOrder",
]) {
  const declaration = new RegExp(`^  (private )?(async )?${name}\\(`, "m");
  assert.ok(
    declaration.test(checkout),
    `"${name}" checkout servisida yo'q.`,
  );
  assert.ok(
    !declaration.test(service),
    `"${name}" buyurtma servisiga qaytib kelgan.`,
  );
}

console.log(
  `Telegram taqdimot ajratmasi validatsiyasi o'tdi (servis ${serviceLines} qator)`,
);
