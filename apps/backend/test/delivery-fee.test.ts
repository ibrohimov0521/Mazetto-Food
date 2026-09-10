import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_SETTING_KEYS,
  describeSettingRule,
  parseIntSetting,
  validateSettingValue,
} from "../src/modules/settings/setting-rules";

/*
 * Yetkazish narxi PUL. Reestrdagi qoida buzilsa, admin panel noto'g'ri
 * qiymatni qabul qilib, mijozdan xato summa olinardi — shuning uchun
 * chegaralar test bilan qulflangan.
 */

test("yetkazish narxi butun son va chegaralangan", () => {
  const rule = describeSettingRule("customer_delivery_fee");
  assert.equal(rule.kind, "int");
  assert.equal(rule.kind === "int" && rule.min, 0);
  /*
   * Yuqori chegara sozlama emas, XATODAN himoya: nol ortiqcha yozilsa
   * (200 000 o'rniga 2 000 000) admin panel darhol rad etadi.
   */
  assert.equal(rule.kind === "int" && rule.max, 1_000_000);
});

test("manfiy narx rad etiladi", () => {
  // Manfiy narx mijozga pul qaytarish degani bo'lardi.
  assert.throws(() => validateSettingValue("customer_delivery_fee", "-1"));
});

test("chegaradan katta narx rad etiladi", () => {
  assert.throws(() => validateSettingValue("customer_delivery_fee", "1000001"));
});

test("kasr qiymat rad etiladi", () => {
  // Tiyin ishlatilmaydi; kasr kirsa Decimal'ga o'tkazishda yaxlitlanardi.
  assert.throws(() => validateSettingValue("customer_delivery_fee", "20000.5"));
});

test("chegaralar o'zi qabul qilinadi", () => {
  assert.equal(validateSettingValue("customer_delivery_fee", "0"), "0");
  assert.equal(
    validateSettingValue("customer_delivery_fee", "1000000"),
    "1000000",
  );
});

test("buzuq saqlangan qiymat default'ga tushadi, xato bermaydi", () => {
  /*
   * O'qish TOLERANT: bazadagi qator qandaydir yo'l bilan buzilsa, checkout
   * qulamasligi kerak — narx default'ga qaytadi. Yozish esa QAT'IY.
   */
  assert.equal(parseIntSetting("customer_delivery_fee", "salom"), 20_000);
  assert.equal(parseIntSetting("customer_delivery_fee", undefined), 20_000);
  assert.equal(parseIntSetting("customer_delivery_fee", "-5"), 20_000);
});

test("narx mijozga ochiq kalitlar ro'yxatida", () => {
  /*
   * Mijoz yetkazish narxini checkout'ga o'tishdan OLDIN ko'rishi kerak.
   * Yashirin narx — oxirgi qadamda tashlab ketishning asosiy sababi.
   */
  assert.ok(
    (PUBLIC_SETTING_KEYS as readonly string[]).includes("customer_delivery_fee"),
  );
});
