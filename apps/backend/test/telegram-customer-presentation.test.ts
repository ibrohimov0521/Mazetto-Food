import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { CustomerOrderType, Prisma } from "@prisma/client";
import {
  branchMapUrl,
  branchSupportsType,
  categoryButtonLabel,
  chunkButtons,
  cleanAddress,
  escapeHtml,
  formatMoney,
  isMessageNotModifiedError,
  isSimpleQuickAddProduct,
  maskPhone,
  parseCustomerOrderType,
  readCartModifiers,
  requiredTelegramId,
  telegramProductButtonLabel,
  type BranchForCheckout,
} from "../src/modules/telegram/telegram-customer-presentation";

/*
 * Bu funksiyalar 1994 qatorlik servis ichida turganda HECH QACHON
 * sinalmagan: uni qo'riqlaydigan 1247 qatorlik validator ularning
 * bittasiga ham tegmasdi. Ajratishning asosiy foydasi shu — endi ular
 * matn moslashtirish orqali emas, haqiqiy chaqiruv bilan tekshiriladi.
 */

function branch(overrides: Partial<BranchForCheckout> = {}): BranchForCheckout {
  return {
    id: "b1",
    name: "Yunusobod",
    acceptsOrders: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    isTemporarilyClosed: false,
    ...overrides,
  };
}

test("HTML qochirish xabar tuzilishini himoya qiladi", () => {
  /*
   * Xabarlar `parse_mode: "HTML"` bilan yuboriladi. Mijoz ismiga `<b>`
   * yozsa, qochirilmagan matn xabar tuzilishini buzardi.
   */
  assert.equal(escapeHtml("<b>Ali</b>"), "&lt;b&gt;Ali&lt;/b&gt;");
  assert.equal(escapeHtml('a & "b"'), "a &amp; &quot;b&quot;");
  // Ampersand BIRINCHI almashtirilishi kerak, aks holda ikki marta qochardi.
  assert.equal(escapeHtml("&lt;"), "&amp;lt;");
});

test("telefon niqoblanadi va qochiriladi", () => {
  assert.equal(maskPhone("+998901234567"), "+998***4567");
  // Qisqa raqam kesilmaydi, lekin baribir qochiriladi.
  assert.equal(maskPhone("<12345>"), "&lt;12345&gt;");
});

test("pul formati o'zbekcha ajratgich bilan", () => {
  const formatted = formatMoney(1234567);
  assert.match(formatted, /so'm$/);
  // Raqamlar guruhlangan bo'lishi kerak (ajratgich belgisi muhitga bog'liq).
  assert.notEqual(formatted, "1234567 so'm");
  assert.equal(formatMoney(new Prisma.Decimal("0")), "0 so'm");
  assert.equal(formatMoney("500"), "500 so'm");
});

test("kategoriya yorlig'i noma'lum kodga ham ikonka beradi", () => {
  assert.equal(categoryButtonLabel("LAVASH", "Lavash"), "🌯 Lavash");
  // Noma'lum kod yiqilmasligi kerak — zaxira ikonka ishlatiladi.
  assert.equal(categoryButtonLabel("YANGI_KOD", "Yangi"), "🍽 Yangi");
  assert.equal(categoryButtonLabel(null, "Nomsiz"), "🍽 Nomsiz");
});

test("mahsulot yorlig'i qisqartiriladi, noma'lumi katalog nomida qoladi", () => {
  assert.equal(
    telegramProductButtonLabel("BIG_CHICKEN_LAVASH", "Katta tovuqli lavash"),
    "Kurinniy Big",
  );
  assert.equal(
    telegramProductButtonLabel("YANGI_MAHSULOT", "Yangi mahsulot"),
    "Yangi mahsulot",
  );
});

test("manzil normallashtiriladi, juda qisqasi rad etiladi", () => {
  assert.equal(cleanAddress("  Amir   Temur   12  "), "Amir Temur 12");
  assert.equal(cleanAddress("abcd"), null);
  assert.equal(cleanAddress("   "), null);
  // Chegara qiymati (5 belgi) qabul qilinadi.
  assert.equal(cleanAddress("abcde"), "abcde");
});

test("xarita havolasi koordinatasiz filialga berilmaydi", () => {
  assert.equal(branchMapUrl({ latitude: null, longitude: null }), null);
  assert.equal(
    branchMapUrl({ latitude: new Prisma.Decimal("41.3"), longitude: null }),
    null,
  );
  assert.match(
    branchMapUrl({
      latitude: new Prisma.Decimal("41.3"),
      longitude: new Prisma.Decimal("69.2"),
    }) ?? "",
    /query=41\.3,69\.2$/,
  );
});

test("yopiq filial hech qanday turni qo'llab-quvvatlamaydi", () => {
  const closed = branch({ isTemporarilyClosed: true });
  assert.equal(branchSupportsType(closed, CustomerOrderType.DELIVERY), false);
  assert.equal(branchSupportsType(closed, CustomerOrderType.PICKUP), false);

  const notAccepting = branch({ acceptsOrders: false });
  assert.equal(
    branchSupportsType(notAccepting, CustomerOrderType.PICKUP),
    false,
  );
});

test("filial turi alohida yoqiladi", () => {
  const pickupOnly = branch({ deliveryEnabled: false });
  assert.equal(
    branchSupportsType(pickupOnly, CustomerOrderType.DELIVERY),
    false,
  );
  assert.equal(branchSupportsType(pickupOnly, CustomerOrderType.PICKUP), true);
});

test("noma'lum buyurtma turi rad etiladi", () => {
  assert.equal(
    parseCustomerOrderType(CustomerOrderType.DELIVERY),
    CustomerOrderType.DELIVERY,
  );
  assert.throws(() => parseCustomerOrderType("QANDAYDIR"), BadRequestException);
  assert.throws(() => parseCustomerOrderType(""), BadRequestException);
});

test("buzuq modifikator yozuvi butun savatni yiqitmaydi", () => {
  /*
   * `modifierSnapshot` — `Json` ustuni, tipi kafolatlanmaydi. Bitta
   * yaroqsiz element butun savatni o'qib bo'lmaydigan qilmasligi kerak.
   */
  const parsed = readCartModifiers([
    { modifierId: "m1", quantity: 2 },
    null,
    "salom",
    [],
    { quantity: 5 },
    { modifierId: "m2" },
  ] as unknown as Prisma.JsonValue);

  assert.deepEqual(parsed, [
    { modifierId: "m1", quantity: 2 },
    // Miqdor berilmasa 1 ga tushadi.
    { modifierId: "m2", quantity: 1 },
  ]);
});

test("massiv bo'lmagan modifikator qiymati bo'sh ro'yxat beradi", () => {
  assert.deepEqual(readCartModifiers(null), []);
  assert.deepEqual(readCartModifiers({} as Prisma.JsonValue), []);
});

test("nol yoki manfiy miqdor 1 ga tushadi", () => {
  const parsed = readCartModifiers([
    { modifierId: "m1", quantity: 0 },
    { modifierId: "m2", quantity: -3 },
  ] as unknown as Prisma.JsonValue);
  assert.deepEqual(parsed, [
    { modifierId: "m1", quantity: 1 },
    { modifierId: "m2", quantity: 1 },
  ]);
});

test("variantsiz mahsulot konfiguratorsiz qo'shiladi", () => {
  assert.equal(isSimpleQuickAddProduct({ variants: [] }), true);
  assert.equal(isSimpleQuickAddProduct({ variants: [{ id: "v1" }] }), true);
  assert.equal(
    isSimpleQuickAddProduct({ variants: [{ id: "v1" }, { id: "v2" }] }),
    false,
  );
  // Maydon umuman bo'lmasa ham yiqilmasligi kerak.
  assert.equal(isSimpleQuickAddProduct({}), true);
});

test("tugmalar qatorlarga bo'linadi", () => {
  assert.deepEqual(chunkButtons([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunkButtons([], 2), []);
  assert.deepEqual(chunkButtons([1], 5), [[1]]);
});

test("'message is not modified' xatosi nosozlik emas", () => {
  /*
   * Bir xil holat ikki marta kelganda Telegram tahrirlashni xato deb
   * qaytaradi. Uni nosozlik deb hisoblash logni to'ldirib yuborardi.
   */
  assert.equal(
    isMessageNotModifiedError(new Error("Bad Request: message is not modified")),
    true,
  );
  assert.equal(isMessageNotModifiedError("MESSAGE IS NOT MODIFIED"), true);
  assert.equal(isMessageNotModifiedError(new Error("timeout")), false);
});

test("bo'sh Telegram id rad etiladi", () => {
  assert.equal(requiredTelegramId(12345, "chat id"), "12345");
  assert.equal(requiredTelegramId("999", "chat id"), "999");
  assert.throws(() => requiredTelegramId(undefined, "chat id"), BadRequestException);
  // Bo'sh satr ham yetishmayotgan deb hisoblanadi.
  assert.throws(() => requiredTelegramId("   ", "chat id"), BadRequestException);
});
