/*
 * Yetkazish narxi PUL, va uning buzilishi jimgina bo'ladi: kod ishlayveradi,
 * faqat mijozdan noto'g'ri summa olinadi. Bu skript narxni "server yagona
 * manba" holatida ushlab turadi.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const rules = read("apps/backend/src/modules/settings/setting-rules.ts");
const settingsService = read(
  "apps/backend/src/modules/settings/settings.service.ts",
);
const engine = read(
  "apps/backend/src/modules/customers/customer-order-engine.service.ts",
);
const checkoutDto = read("apps/backend/src/modules/customers/dto/customer.dto.ts");
const adminSettings = read("apps/pos-web/components/admin/admin-settings.tsx");

// --- Reestr ---
assert.match(
  rules,
  /customer_delivery_fee: INT\(0, 1_000_000, 20_000\)/,
  "Yetkazish narxi reestrda yo'q yoki chegaralari o'zgargan.",
);
assert.match(
  rules,
  /"customer_delivery_fee",/,
  "Narx PUBLIC_SETTING_KEYS da yo'q — mijoz uni checkout'gacha ko'rmaydi.",
);
assert.match(
  settingsService,
  /customerDeliveryFee: await this\.getInt\("customer_delivery_fee"\)/,
  "Ochiq sozlamalar javobida narx yo'q.",
);

// --- Server yagona manba ---
assert.match(
  engine,
  /this\.settings\.getInt\("customer_delivery_fee"\)/,
  "Narx sozlamadan o'qilmayapti — kodda qattiq yozilgan bo'lishi mumkin.",
);
assert.match(
  engine,
  /if \(type === OnlineOrderTypeDto\.PICKUP\) \{\s*return new Prisma\.Decimal\(0\);/,
  "Olib ketishda narx 0 emas — mijoz o'zi kelganda yetkazish xizmati yo'q.",
);

/*
 * Mijoz yuborgan narx QABUL QILINMASLIGI kerak. DTO'da `deliveryFee` yoki
 * `total` maydoni paydo bo'lsa, buyurtma narxini mijoz o'zi belgilay olardi.
 */
const checkoutBody =
  checkoutDto.match(/class CreateOnlineOrderDto \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.ok(checkoutBody, "CreateOnlineOrderDto topilmadi.");
for (const field of ["deliveryFee", "total", "subtotal", "price"]) {
  assert.doesNotMatch(
    checkoutBody,
    new RegExp(`\\b${field}\\??:`),
    `CreateOnlineOrderDto da "${field}" bor — mijoz narxni o'zi belgilay olardi.`,
  );
}

/*
 * Sozlama o'qishi TRANZAKSIYADAN TASHQARIDA bo'lishi kerak: u Redis keshiga
 * yoki bazaga boradi, va ochiq tranzaksiyani tashqi kutish vaqtiga bog'lab
 * qo'yish ulanishlar hovuzini tugatadi.
 */
const createOrder =
  engine.match(/async createOnlineOrder\([\s\S]*?\n {2}async /)?.[0] ?? "";
assert.ok(createOrder, "createOnlineOrder topilmadi.");
const feeAt = createOrder.indexOf("await this.resolveDeliveryFee(");
const txAt = createOrder.indexOf("this.prisma.$transaction(");
assert.ok(feeAt !== -1, "createOnlineOrder narxni hisoblamayapti.");
assert.ok(txAt !== -1, "createOnlineOrder tranzaksiyasi topilmadi.");
assert.ok(
  feeAt < txAt,
  "Sozlama tranzaksiya ICHIDA o'qilyapti — ochiq tranzaksiya tashqi kutishga bog'lanadi.",
);

// --- Admin panel ---
assert.match(
  adminSettings,
  /customer_delivery_fee: \{/,
  "Admin panelda narx uchun yorliq yo'q — kalit nomi xom ko'rinadi.",
);

console.log("Yetkazish narxi validatsiyasi o'tdi");
