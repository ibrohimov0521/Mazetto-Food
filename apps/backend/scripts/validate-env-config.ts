import * as assert from "node:assert/strict";
import { validateEnvironment } from "../src/config/env";

/*
 * Muhit konfiguratsiyasi sxemasi (7-bosqich Q3.1).
 *
 * Bu skript bazani TALAB QILMAYDI — u faqat sxemaning o'zini tekshiradi.
 *
 * Nima uchun kerak: konfiguratsiya xatolari eng qimmat turdagi nosozlik,
 * chunki ular ishga tushish paytida emas, birinchi marta o'sha yo'lga
 * kirilganda bilinardi. Sxema ularni boot'ga suradi, bu skript esa sxemaning
 * o'zi kutilganicha ishlashini ushlab turadi.
 */

const BASE = { DATABASE_URL: "postgresql://user:pass@localhost:5432/db" };

// --- Majburiy qiymatlar --------------------------------------------------

assert.throws(
  () => validateEnvironment({}),
  /DATABASE_URL/,
  "DATABASE_URL yo'qligi ushlanishi kerak",
);

// --- Turlar --------------------------------------------------------------

assert.throws(
  () => validateEnvironment({ ...BASE, BACKEND_PORT: "abc" }),
  /BACKEND_PORT/,
  "raqam bo'lmagan port ushlanishi kerak",
);

assert.throws(
  () => validateEnvironment({ ...BASE, TRUSTED_PROXY_HOP_COUNT: "-1" }),
  /TRUSTED_PROXY_HOP_COUNT/,
  "manfiy hop soni ushlanishi kerak",
);

/*
 * ENG MUHIM HOLAT.
 *
 * `z.coerce.boolean()` ishlatilganda "false" SATRI `Boolean("false") === true`
 * bo'lib ketardi va bayroqni env orqali o'chirib bo'lmasdi. Kill switch uchun
 * bu jimgina ishlab turadigan funksiya degani.
 */
assert.equal(
  validateEnvironment({ ...BASE, SWAGGER_ENABLED: "false" }).SWAGGER_ENABLED,
  false,
  '"false" satri FALSE bo\'lishi shart',
);
assert.equal(
  validateEnvironment({ ...BASE, SWAGGER_ENABLED: "0" }).SWAGGER_ENABLED,
  false,
);
assert.equal(
  validateEnvironment({ ...BASE, SWAGGER_ENABLED: "true" }).SWAGGER_ENABLED,
  true,
);
assert.equal(
  validateEnvironment({ ...BASE, SWAGGER_ENABLED: "" }).SWAGGER_ENABLED,
  false,
  "bo'sh satr default'ga tushishi kerak (Docker build-arg shunday keladi)",
);

// --- Ishlab chiqarish sirlari -------------------------------------------

const productionError = (() => {
  try {
    validateEnvironment({ ...BASE, NODE_ENV: "production" });
    return "";
  } catch (error) {
    return String((error as Error).message);
  }
})();

assert.ok(productionError, "ishlab chiqarishda sirlarsiz ishga tushmasligi kerak");

// To'rttasi ham BIRDAN ko'rsatiladi — `auth.config.ts` birinchisida to'xtaydi,
// ya'ni ularni topish uchun to'rt marta qayta ishga tushirish kerak bo'lardi.
for (const secret of [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "CUSTOMER_JWT_ACCESS_SECRET",
  "CUSTOMER_JWT_REFRESH_SECRET",
]) {
  assert.ok(
    productionError.includes(secret),
    `${secret} yetishmayotganlar ro'yxatida bo'lishi kerak`,
  );
}

// Ishlab chiqishda esa sirlarsiz ham ishlaydi (`auth.config.ts` fallback beradi).
assert.doesNotThrow(() => validateEnvironment(BASE));

// --- Default qiymatlar ---------------------------------------------------

const defaults = validateEnvironment(BASE);

assert.equal(defaults.NODE_ENV, "development");
assert.equal(defaults.BACKEND_PORT, 4000);
// 0 = hech qanday proxy header'iga ishonilmaydi (PHASE 6 H1).
assert.equal(defaults.TRUSTED_PROXY_HOP_COUNT, 0);
assert.equal(defaults.JWT_ACCESS_EXPIRES_IN_SECONDS, 900);
assert.equal(defaults.CORS_ORIGIN, undefined);

console.log("Environment configuration validation passed");
