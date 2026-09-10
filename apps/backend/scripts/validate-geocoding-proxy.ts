/*
 * Geokodlash proxy'sining buzilishi JIMGINA bo'ladi: ilova ishlayveradi,
 * faqat manzil yorlig'i yo'qoladi yoki — yomoni — Nominatim bizni bloklaydi
 * va buni faqat ishlab chiqarishda bilamiz. Shuning uchun bu skript
 * "ko'rinmaydigan" shartlarni qulflaydi.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const service = read("apps/backend/src/modules/geocoding/geocoding.service.ts");
const controller = read(
  "apps/backend/src/modules/geocoding/geocoding.controller.ts",
);
const appModule = read("apps/backend/src/app.module.ts");
const envConfig = read("apps/backend/src/config/env.ts");

// --- Modul ulangan bo'lsin ---
assert.match(appModule, /GeocodingModule/, "GeocodingModule app.module da yo'q.");

// --- Nominatim siyosati ---
assert.match(
  service,
  /"User-Agent":\s*"MazettoFood/,
  "Nominatim aniqlanadigan User-Agent ni TALAB qiladi — usiz IP bloklanadi.",
);
assert.match(
  service,
  /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/,
  "Tashqi so'rovda timeout yo'q — geokoder osilsa checkout ham osiladi.",
);
assert.match(
  service,
  /NOMINATIM_URL/,
  "Baza URL env'dan olinmayapti — self-hosted nusxaga o'tish uchun frontend relizi kerak bo'lardi.",
);
assert.match(
  envConfig,
  /NOMINATIM_URL: optionalText/,
  "NOMINATIM_URL env sxemasida yo'q.",
);

// --- FAIL-OPEN: eng muhim xususiyat ---
assert.match(
  service,
  /if \(!payload\) \{\s*return \{ label: "", inCity: true \};/,
  "Reverse fail-open emas — geokoder tushganda buyurtma bloklanardi.",
);
/*
 * Fail-open natijasi keshlanmasligi SHART: aks holda bir daqiqalik uzilish
 * 30 kunga muzlab qolardi. Buni tekshirishning ishonchli usuli — `setJson`
 * chaqiruvi fail-open `return` dan KEYIN turishi.
 */
const reverseBody =
  service.match(/async reverse\([\s\S]*?\n {2}async search\(/)?.[0] ?? "";
assert.ok(reverseBody, "reverse metodi topilmadi.");
const failOpenAt = reverseBody.indexOf('return { label: "", inCity: true };');
const cacheWriteAt = reverseBody.indexOf("setJson(key, result");
assert.ok(failOpenAt !== -1 && cacheWriteAt !== -1);
assert.ok(
  failOpenAt < cacheWriteAt,
  "Fail-open natijasi keshlanyapti — uzilish 30 kunga muzlab qolardi.",
);

// --- Kesh ---
assert.match(
  service,
  /geo:rev:\$\{language\}:\$\{latitude\.toFixed\(KEY_PRECISION\)\}/,
  "Reverse kesh kaliti koordinatani yaxlitlamayapti — qo'shni nuqtalar alohida so'rov bo'lardi.",
);
assert.match(
  service,
  /const KEY_PRECISION = 4/,
  "Kesh aniqligi 4 kasr (~11 m) bo'lishi kutilgan.",
);
assert.match(
  service,
  /REVERSE_TTL_MS = 30 \* 24 \* 60 \* 60 \* 1000/,
  "Reverse TTL 30 kun bo'lishi kerak — manzillar ko'chmaydi.",
);
assert.match(
  service,
  /SEARCH_TTL_MS = 7 \* 24 \* 60 \* 60 \* 1000/,
  "Search TTL 7 kun bo'lishi kerak.",
);

// --- Ikkinchi qatlam: mamlakat va viloyat ---
assert.match(
  service,
  /country_code \?\? ""\)\.toLowerCase\(\) === "uz"/,
  "Mamlakat tekshiruvi yo'q.",
);
/*
 * Nominatim `state` ni `accept-language` ga TARJIMA qiladi, shuning uchun
 * regex uchala tilni ham ushlashi kerak. Bittasi tushib qolsa, o'sha tildagi
 * viloyat manzili shahar deb qabul qilinardi.
 */
for (const word of ["viloyat", "область", "region"]) {
  assert.match(
    service,
    new RegExp(`REGION_PATTERN[\\s\\S]{0,80}${word}`),
    `REGION_PATTERN da "${word}" yo'q — o'sha tildagi viloyat o'tib ketardi.`,
  );
}

// --- Qidiruv Toshkent bilan chegaralangan ---
for (const [param, why] of [
  ["countrycodes", "boshqa mamlakat natijalari chiqardi"],
  ["viewbox", "qidiruv butun O'zbekiston bo'ylab ketardi"],
  ["bounded", "viewbox faqat tavsiya bo'lib qolardi"],
] as const) {
  assert.match(
    service,
    new RegExp(`searchParams\\.set\\("${param}"`),
    `Qidiruvda "${param}" yo'q — ${why}.`,
  );
}
assert.match(
  service,
  /isWithinTashkent\(item\.latitude, item\.longitude\)/,
  "Qidiruv natijalari zona bo'yicha filtrlanmayapti.",
);

// --- Kirish va chegara ---
assert.match(
  controller,
  /@Public\(\)/,
  "Manzil tanlash tizimga kirmasdan ham ochiladi — endpoint Public bo'lishi kerak.",
);
assert.match(
  controller,
  /@Throttle\(\{ default: \{ ttl: 60_000, limit: 30 \} \}\)/,
  "Ochiq endpointda alohida, qattiqroq chegara bo'lishi SHART: global 300/daqiqa " +
    "kassa uchun mo'ljallangan va bu yerda Nominatim siyosati buziladi.",
);
/*
 * Reverse zonadan TASHQARIDAGI nuqta uchun ham ishlashi kerak — aynan shunda
 * `inCity: false` qaytib, foydalanuvchiga nima uchun rad etilgani aytiladi.
 */
assert.doesNotMatch(
  controller,
  /isWithinTashkent/,
  "Kontrollerda zona tekshiruvi bor — u `inCity: false` javobini imkonsiz qiladi.",
);

console.log("Geokodlash proxy validatsiyasi o'tdi");
