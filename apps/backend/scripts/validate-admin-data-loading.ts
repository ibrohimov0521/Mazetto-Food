/*
 * Admin ekranlarida ma'lumot yuklash (6.1).
 *
 * TUZATILGAN XATO. 22 ta admin komponenti ma'lumotni qo'lda yuklardi va
 * ularning HECH BIRIDA javob tartibi qo'riqchisi yo'q edi. Kamida
 * oltitasi filtr o'zgarganda qayta yuklaydi, ya'ni filtrni tez ikki
 * marta almashtirganda ikkita so'rov yo'lda bo'ladi va SEKINROG'I
 * oxirgi bo'lib keladi — jadval oldingi filtr ma'lumotini ko'rsatadi,
 * boshqaruvlar esa yangisini.
 *
 * Bunday xato test bilan tutilmaydi va ekranda "shunchaki sekin
 * yuklandi" kabi ko'rinadi, shuning uchun manba darajasida qulflandi.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const hook = read("apps/pos-web/lib/use-api-resource.ts");

// --- Qo'riqchining o'zi ---
assert.match(
  hook,
  /const version = \+\+request\.current;/,
  "Har so'rovga navbat raqami berilmayapti.",
);
assert.match(
  hook,
  /if \(version !== request\.current\) return;\s*\n\s*setData\(next\)/,
  "Eskirgan javob tashlanmayapti — poyga holati qaytadi.",
);
/*
 * Xato yo'lida ham tekshirilishi SHART: eskirgan so'rovning xatosi
 * yangi, muvaffaqiyatli natijani xato xabari bilan almashtirib
 * qo'yardi.
 */
assert.match(
  hook,
  /\} catch \(caught\) \{\s*\n\s*if \(version !== request\.current\) return;/,
  "Eskirgan javobning XATOSI tashlanmayapti.",
);
/*
 * Komponent yopilganda navbat raqami surilishi kerak — yo'ldagi javob
 * yopilgan komponentga yozishga urinmasin.
 */
assert.match(
  hook,
  /return \(\) => \{[\s\S]{0,200}request\.current \+= 1;/,
  "Tozalashda navbat raqami surilmayapti.",
);
assert.match(
  hook,
  /if \(caught instanceof SessionExpiredError\) return;/,
  "Sessiya tugashi jimgina yutilmayapti — foydalanuvchi login sahifasiga o'tayotib xato ko'rardi.",
);

/*
 * FILTRGA BOG'LIQ ekranlar qo'lda yuklashga QAYTMASIN. Aynan ularda
 * poyga holati yuzaga keladi.
 */
const adminDir = "apps/pos-web/components/admin";
const files = readdirSync(join(root, adminDir)).filter((name) =>
  name.endsWith(".tsx"),
);

const converted = [
  "admin-audit.tsx",
  "admin-couriers.tsx",
  "admin-customers.tsx",
  "admin-dashboard.tsx",
  "admin-expenses.tsx",
  "admin-online-orders.tsx",
  "admin-orders.tsx",
  "admin-payments.tsx",
  "admin-product-editor.tsx",
  "admin-receipts.tsx",
  "admin-report-views.tsx",
  "admin-shifts.tsx",
];

for (const name of converted) {
  const source = read(`${adminDir}/${name}`);
  assert.match(
    source,
    /useApiResource\s*[<(]/,
    `${name} qo'lda yuklashga qaytgan — poyga holati tiklanadi.`,
  );
}

/*
 * Filtrga bog'liq YANGI ekran qo'shilsa ham qo'riqchisiz qolmasin:
 * `useCallback` ichida yuklash + filtr bog'liqligi kombinatsiyasi
 * aynan xato naqshi.
 */
const suspicious: string[] = [];
for (const name of files) {
  const source = read(`${adminDir}/${name}`);
  const handRolled = /const load = useCallback\(async \(\) => \{[\s\S]*?\}, \[([^\]]*)\]\);/.exec(
    source,
  );
  if (!handRolled) continue;
  const deps = handRolled[1] ?? "";
  // Bog'liqliksiz yuklash poyga yaratmaydi — faqat filtrga bog'liqlari xavfli.
  if (deps.trim() && !/useApiResource\s*[<(]/.test(source)) {
    suspicious.push(`${name} (deps: ${deps.trim()})`);
  }
}

assert.deepEqual(
  suspicious,
  [],
  "Filtrga bog'liq qo'lda yuklash topildi — `useApiResource` ishlating:\n  " +
    suspicious.join("\n  "),
);

console.log(
  `Admin ma'lumot yuklash validatsiyasi o'tdi (${converted.length} ekran qo'riqchi ostida)`,
);
