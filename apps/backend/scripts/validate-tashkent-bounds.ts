/*
 * Yetkazish zonasi chegarasi backend va customer-web da IKKI NUSXADA turadi.
 *
 * Nima uchun nusxa: `packages/*` pnpm workspace'ga ulanmagan (pnpm-workspace.yaml
 * faqat `apps/*` ni oladi) va u yerda manba kodi yo'q — faqat eski `dist`
 * qoldiqlari. Bitta konstanta uchun to'liq workspace paketi ko'tarish,
 * build/typecheck quvurlariga ulash qimmat.
 *
 * Nusxaning yagona xavfi — ajralib qolish. Bu skript aynan shuni to'sadi:
 * raqamlar farq qilsa CI yiqiladi. Nusxa xavfsiz bo'lishining sababi ham shu,
 * shuning uchun bu skriptni o'chirmang.
 *
 * TARIX: eski quti 41.45 / 69.5 edi va Toshkent VILOYATI hamda Saryog'och
 * (Qozog'iston) hududini qamrab olardi — kuryer bora olmaydigan joyga
 * buyurtma tushardi.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const backendSource = read(
  "apps/backend/src/modules/customers/tashkent-bounds.ts",
);
const webSource = read("apps/customer-web/lib/tashkent-bounds.ts");

/** `latMin: 41.18,` kabi qatorlardan raqamlarni yig'adi. */
function readBounds(source: string, label: string) {
  const keys = ["latMin", "latMax", "lngMin", "lngMax"] as const;
  const values: Record<string, number> = {};
  for (const key of keys) {
    const match = source.match(new RegExp(`${key}:\\s*(-?\\d+(?:\\.\\d+)?)`));
    assert.ok(match, `${label}: ${key} topilmadi`);
    values[key] = Number(match[1]);
  }
  return values as Record<(typeof keys)[number], number>;
}

function readCenter(source: string, label: string) {
  const keys = ["latitude", "longitude"] as const;
  const block = source.match(/TASHKENT_CENTER = \{[\s\S]*?\}/)?.[0];
  assert.ok(block, `${label}: TASHKENT_CENTER topilmadi`);
  const values: Record<string, number> = {};
  for (const key of keys) {
    const match = block.match(new RegExp(`${key}:\\s*(-?\\d+(?:\\.\\d+)?)`));
    assert.ok(match, `${label}: ${key} topilmadi`);
    values[key] = Number(match[1]);
  }
  return values as Record<(typeof keys)[number], number>;
}

const backend = readBounds(backendSource, "backend");
const web = readBounds(webSource, "customer-web");

assert.deepEqual(
  backend,
  web,
  "Toshkent chegarasi backend va customer-web da FARQ qilyapti. " +
    `backend=${JSON.stringify(backend)} web=${JSON.stringify(web)}. ` +
    "Ikkala faylni ham yangilang.",
);

assert.deepEqual(
  readCenter(backendSource, "backend"),
  readCenter(webSource, "customer-web"),
  "TASHKENT_CENTER ikki tomonda farq qilyapti.",
);

// Quti mantiqan to'g'ri bo'lsin.
assert.ok(backend.latMin < backend.latMax, "latMin latMax dan kichik bo'lsin");
assert.ok(backend.lngMin < backend.lngMax, "lngMin lngMax dan kichik bo'lsin");

/*
 * Eski, xato qutiga qaytib qolishdan himoya. 41.45 Toshkent viloyatiga va
 * Qozog'iston chegarasiga chiqadi; 69.5 sharqqa haddan tashqari cho'ziladi.
 * Bu chegaralar shahar uchun yuqori chegara, aniq raqam emas.
 */
assert.ok(
  backend.latMax <= 41.42,
  `latMax=${backend.latMax} juda katta — bu Toshkent viloyati, shahri emas.`,
);
assert.ok(
  backend.lngMax <= 69.45,
  `lngMax=${backend.lngMax} juda katta — bu Toshkent viloyati, shahri emas.`,
);

// Toshkent markazi qutining ichida bo'lishi shart.
const center = readCenter(backendSource, "backend");
assert.ok(
  center.latitude >= backend.latMin &&
    center.latitude <= backend.latMax &&
    center.longitude >= backend.lngMin &&
    center.longitude <= backend.lngMax,
  "TASHKENT_CENTER quti ichida emas — xarita chegaradan tashqarida ochiladi.",
);

/*
 * Server majburlashi. Frontend tekshiruvi chetlab o'tiladi (mijoz API'ga
 * to'g'ridan-to'g'ri murojaat qila oladi), shuning uchun buyurtma va manzil
 * saqlash yo'llari o'tadigan yagona nuqtada tekshiruv turishi SHART.
 */
const normalize = read("apps/backend/src/modules/customers/delivery-location.ts");
assert.match(
  normalize,
  /import \{ isWithinTashkent \} from "\.\/tashkent-bounds"/,
  "delivery-location.ts zona tekshiruvini import qilmayapti.",
);
assert.match(
  normalize,
  /if \(!isWithinTashkent\(value\.latitude, value\.longitude\)\)/,
  "normalizeDeliveryLocation zonani tekshirmayapti — server majburlashi yo'q.",
);
assert.match(
  normalize,
  /faqat Toshkent shahri/,
  "Zonadan tashqari xabari yo'q yoki o'zgargan.",
);

// Ikkala manzil yo'li ham shu funksiyadan o'tishi kerak.
for (const [path, label] of [
  [
    "apps/backend/src/modules/customers/customer-order-engine.service.ts",
    "buyurtma yaratish",
  ],
  [
    "apps/backend/src/modules/customers/customer-addresses.service.ts",
    "manzil saqlash",
  ],
] as const) {
  assert.match(
    read(path),
    /normalizeDeliveryLocation/,
    `${label} yo'li normalizeDeliveryLocation dan o'tmayapti — zona tekshirilmaydi.`,
  );
}

/*
 * Frontend qatlami. Bu majburlash emas, lekin usiz foydalanuvchi zonadan
 * tashqaridagi nuqtani tanlab, faqat checkout'da 400 xatoni ko'radi.
 */
const map = read("apps/customer-web/components/delivery-map.tsx");
assert.match(map, /maxBounds: TASHKENT_LEAFLET_BOUNDS/, "Xaritada maxBounds yo'q.");
assert.match(map, /maxBoundsViscosity: 1/, "maxBoundsViscosity yo'q.");
assert.match(
  map,
  /emit\.current = \(next: DeliveryPoint\) => \{[\s\S]{0,200}isWithinTashkent/,
  "Xaritadagi yagona chiqish nuqtasi zonani tekshirmayapti.",
);
// Bosish, surish va GPS — uchalasi ham o'sha nuqtadan o'tsin.
assert.equal(
  (map.match(/emit\.current\(/g) ?? []).length,
  3,
  "Xaritada nuqta chiqarish joylari soni 3 emas — yangi manba qo'shilgan bo'lsa, u ham tekshiruvdan o'tishi kerak.",
);
assert.doesNotMatch(
  map,
  /callback\.current\(/,
  "Xaritada tekshiruvni chetlab o'tadigan eski `callback.current(` chaqiruvi qolgan.",
);

const webLocation = read("apps/customer-web/lib/delivery-location.ts");
assert.match(
  webLocation,
  /isWithinTashkent\(location\.latitude, location\.longitude\)/,
  "isDeliveryLocation saqlangan manzillar uchun zonani tekshirmayapti.",
);

console.log("Toshkent yetkazish zonasi validatsiyasi o'tdi");
