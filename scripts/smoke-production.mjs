#!/usr/bin/env node

/*
 * Production smoke — relizdan KEYIN.
 *
 * Reliz yozuvlaridagi qo'lda qilinadigan "public route health" va "API smoke"
 * qadamlari (MAZETTO_RELEASE_READINESS_CHECKLIST.md, 9–10) bitta buyruqqa
 * yig'ilgan. Faqat GET: buyurtma yaratmaydi, hech narsani o'zgartirmaydi,
 * shuning uchun istalgan paytda yurgizish xavfsiz.
 *
 *   pnpm release:smoke
 *   MAZETTO_WEB_URL=http://127.0.0.1:3000 pnpm release:smoke
 *
 * CI ko'rmaydigan narsalarning bir qismini ushlaydi: servis ko'tarilmagani,
 * domen/Cloudflare yo'naltirishi, baza ulanishi, himoya ochilib qolgani.
 * Dizayn, mobil layout, Telegram va printer baribir qo'lda tekshiriladi.
 */

const api = process.env.MAZETTO_API_URL ?? "https://api.mazettofood.uz/api/v1";
const web = process.env.MAZETTO_WEB_URL ?? "https://mazettofood.uz";
const pos = process.env.MAZETTO_POS_URL ?? "https://pos.mazettofood.uz";
const media = process.env.MAZETTO_MEDIA_URL ?? "https://media.mazettofood.uz";

/*
 * { name, url, status, body? }
 *
 * 401 lar ATAYLAB: himoyalangan endpoint tokensiz ochilib qolsa, u 200 bo'lib
 * ko'rinadi va hech qanday health buni bildirmaydi.
 */
const checks = [
  {
    name: "backend health + baza",
    url: `${api}/health`,
    status: [200],
    body: (text) => text.includes('"database":{"status":"ok"}'),
  },
  { name: "API filiallar", url: `${api}/customer/branches`, status: [200] },
  {
    name: "API menyu kategoriyalari",
    url: `${api}/customer/menu/categories`,
    status: [200],
  },
  {
    name: "API menyu mahsulotlari",
    url: `${api}/customer/menu/products`,
    status: [200],
  },
  { name: "API bosh sahifa", url: `${api}/customer/home`, status: [200] },
  {
    name: "oshxona tokensiz yopiq",
    url: `${api}/kitchen/orders`,
    status: [401],
  },
  {
    name: "POS katalog tokensiz yopiq",
    url: `${api}/pos/catalog`,
    status: [401],
  },
  {
    name: "mijoz buyurtmalari tokensiz yopiq",
    url: `${api}/customer/me/orders`,
    status: [401],
  },
  { name: "customer-web health", url: `${web}/api/health`, status: [200] },
  ...["/", "/menu", "/cart", "/checkout", "/orders", "/profile"].map(
    (path) => ({
      name: `customer-web ${path}`,
      url: `${web}${path}`,
      status: [200],
    }),
  ),
  { name: "pos-web health", url: `${pos}/api/health`, status: [200] },
  { name: "pos-web /login", url: `${pos}/login`, status: [200] },
  { name: "media health", url: `${media}/healthz`, status: [200, 204] },
];

async function run(check) {
  try {
    const response = await fetch(check.url, {
      headers: { "User-Agent": "mazetto-release-smoke" },
      // Yo'naltirish ham xato: masalan /orders login'ga otib yuborsa, 200 emas.
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();

    if (!check.status.includes(response.status)) {
      return `${response.status}, kutilgan ${check.status.join("/")}`;
    }

    if (check.body && !check.body(text)) {
      return `${response.status}, lekin javob mazmuni kutilgandek emas: ${text.slice(0, 160)}`;
    }

    return null;
  } catch (error) {
    return `javob yo'q (${error.cause?.code ?? error.name})`;
  }
}

let failed = 0;

for (const check of checks) {
  const problem = await run(check);

  if (problem === null) {
    console.log(`  OK   ${check.name}`);
  } else {
    console.log(`  FAIL ${check.name} — ${problem}\n       ${check.url}`);
    failed += 1;
  }
}

console.log(`\n${checks.length - failed}/${checks.length} tekshiruv o'tdi`);

// `process.exit()` EMAS: Windows'da ochiq fetch ulanishi bilan chaqirilsa Node
// libuv assertion bilan qulaydi va chiqish kodi 1 emas, 127 bo'lib qoladi.
if (failed > 0) {
  process.exitCode = 1;
}
