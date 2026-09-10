import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCustomerPhone } from "../src/modules/customers/customer-phone";
import { formatPhone, normalizePhone } from "../../customer-web/lib/phone";

/*
 * Telefon normalizatsiyasi ikki joyda yashaydi: serverda (majburlash) va
 * brauzerda (qulaylik). Ular AJRALIB KETSA, mijoz brauzerda qabul qilingan
 * raqamni yuboradi va server uni rad etadi — yoki teskarisi, brauzer
 * yaroqli raqamni rad etadi.
 *
 * Shuning uchun bu test ikkalasini BIR XIL kirishlarda solishtiradi.
 */

const CASES: Array<[string, string | null]> = [
  // Mahalliy formatlar — hammasi bir xil natijaga kelishi kerak.
  ["901234567", "+998901234567"],
  ["90 123 45 67", "+998901234567"],
  ["90-123-45-67", "+998901234567"],
  ["+998901234567", "+998901234567"],
  ["998901234567", "+998901234567"],
  ["+998 90 123 45 67", "+998901234567"],
  ["  +998901234567  ", "+998901234567"],
  ["00998901234567", "+998901234567"],

  // Yaroqsiz.
  ["", null],
  ["123", null],
  ["9012345678", null], // bitta ortiqcha raqam
  ["90123456", null], // bitta kam
  ["+79012345678", null], // Rossiya raqami
  ["salom", null],
];

test("brauzer va server normalizatsiyasi bir xil natija beradi", () => {
  for (const [input, expected] of CASES) {
    const browser = normalizePhone(input);
    assert.equal(browser, expected, `brauzer: "${input}"`);

    if (expected === null) {
      assert.throws(
        () => normalizeCustomerPhone(input),
        `server "${input}" ni rad etishi kerak edi`,
      );
    } else {
      assert.equal(
        normalizeCustomerPhone(input),
        expected,
        `server: "${input}"`,
      );
    }
  }
});

test("boshqa mamlakat kodi O'zbekiston raqamiga aylanmaydi", () => {
  /*
   * Eng nozik holat: "+7 998 123 45 67" dan raqamlar ajratilsa
   * "79981234567" chiqadi. Agar "+" tekshiruvi bo'lmasa, prefiks mantiqi
   * uni "998..." ga aylantirib, Rossiya raqamini O'zbekiston raqami
   * sifatida qabul qilib yuborardi.
   */
  assert.equal(normalizePhone("+7 998 123 45 67"), null);
  assert.throws(() => normalizeCustomerPhone("+7 998 123 45 67"));
});

test("ko'rsatish formati o'qilishi oson", () => {
  assert.equal(formatPhone("901234567"), "+998 90 123 45 67");
  // Yaroqsiz bo'lsa xom qiymat qaytadi — kiritish paytida shakl buzilmasin.
  assert.equal(formatPhone("123"), "123");
});
