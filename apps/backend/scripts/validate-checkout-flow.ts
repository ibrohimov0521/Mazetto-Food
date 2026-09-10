/*
 * Checkout oqimining uchta xususiyati JIMGINA buziladi — kod ishlayveradi,
 * faqat foydalanuvchi noto'g'ri narsani ko'radi. Shuning uchun qulflandi.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const checkout = read("apps/customer-web/app/checkout/page.tsx");
const phoneLib = read("apps/customer-web/lib/phone.ts");
const checkoutCss = read("apps/customer-web/app/checkout/checkout.css");

/*
 * 1. "Buyurtma berildi" bayrog'i.
 *
 * `clearCart()` va `router.push()` orasida React qayta chizadi. Bayroqsiz
 * o'sha lahzada "Savatingiz bo'sh" ekrani chaqnab ketardi.
 */
assert.match(
  checkout,
  /const placed = useRef\(false\)/,
  "`placed` bayrog'i yo'q.",
);
assert.match(
  checkout,
  /if \(!items\.length && !placed\.current\)/,
  "Bo'sh savat guardi `placed` ni hisobga olmayapti.",
);
const submitBody =
  checkout.match(/async function submitOrder\([\s\S]*?\n {2}\}/)?.[0] ?? "";
assert.ok(submitBody, "submitOrder topilmadi.");
const flagAt = submitBody.indexOf("placed.current = true");
const clearAt = submitBody.indexOf("clearCart()");
assert.ok(flagAt !== -1, "submitOrder bayroqni o'rnatmayapti.");
assert.ok(clearAt !== -1, "submitOrder savatni tozalamayapti.");
assert.ok(
  flagAt < clearAt,
  "Bayroq `clearCart()` dan KEYIN o'rnatilyapti — guard baribir ishga tushadi.",
);

/*
 * 2. Telefon normalizatsiyasi brauzerda ham.
 *
 * Ilgari brauzer shaklni faqat tekshirardi va XOM satrni yuborardi.
 */
assert.match(
  phoneLib,
  /export function normalizePhone/,
  "Brauzer tomonida normalizePhone yo'q.",
);
assert.doesNotMatch(
  phoneLib,
  /throw /,
  "Brauzer normalizatsiyasi xato TASHLAMASLIGI kerak — shakl buziladi; `null` qaytarsin.",
);
assert.match(
  checkout,
  /if \(!normalizePhone\(phone\)\)/,
  "Checkout validatsiyasi normalizePhone ishlatmayapti.",
);
assert.match(
  checkout,
  /phone: normalizePhone\(phone\) \?\? phone\.trim\(\)/,
  "Serverga xom telefon yuborilyapti.",
);
/*
 * Eski regex boshqa mamlakat kodini o'tkazib yuborardi. U qaytib kelmasin.
 */
assert.doesNotMatch(
  checkout,
  /\^\(\?:998\)\?\\d\{9\}\$/,
  "Eski, kamchilikli telefon regexi qaytib kelgan.",
);

/*
 * 3. To'lov usullari YASHIRILMAYDI.
 *
 * Yashirilgan usul "bu yerda yo'q" deydi; belgi esa "hozircha yo'q" deydi.
 */
assert.match(
  checkout,
  /available: allowedCodes\.has\(option\.value\)/,
  "Usul mavjudligi server javobidan olinmayapti.",
);
assert.doesNotMatch(
  checkout,
  /paymentOptions\.filter\(/,
  "Usullar filtrlanib YASHIRILYAPTI — ular ko'rsatilib, sababi tushuntirilishi kerak.",
);
assert.match(checkout, /Tez kunda/, '"Tez kunda" belgisi yo\'q.');
assert.match(
  checkoutCss,
  /\.mf-checkout-payment\.is-soon/,
  "Ishga tushmagan usul uchun uslub yo'q.",
);
/*
 * Kotirovka kelmagunicha server hech narsa aytmagan — o'shanda hammasini
 * "Tez kunda" deb belgilash yolg'on bo'lardi.
 */
assert.match(
  checkout,
  /if \(!allowedCodes\.size\) \{[\s\S]{0,120}available: true/,
  "Kotirovka yo'q holatida hammasi 'Tez kunda' bo'lib qolyapti.",
);

/*
 * Narx faqat SERVERDAN (D8). Mijoz tomoni hech qachon o'zi hisoblamaydi —
 * bu AUD-001 muammosining ildizi edi.
 */
assert.match(
  checkout,
  /const deliveryFee = quote \? Number\(quote\.deliveryFee\) : 0/,
  "Yetkazish narxi kotirovkadan olinmayapti.",
);
assert.doesNotMatch(
  checkout,
  /subtotal \* |deliveryFee = \d/,
  "Mijoz tomoni narxni o'zi hisoblayotganga o'xshaydi.",
);

console.log("Checkout oqimi validatsiyasi o'tdi");
