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

import { fetchWithTransientRetry } from "./http-with-transient-retry.mjs";
import { resolveMediaAssetUrl } from "./smoke-media-asset-url.mjs";

const api = process.env.MAZETTO_API_URL ?? "https://api.mazettofood.uz/api/v1";
const web = process.env.MAZETTO_WEB_URL ?? "https://mazettofood.uz";
const www = process.env.MAZETTO_WWW_URL ?? "https://www.mazettofood.uz";
const pos = process.env.MAZETTO_POS_URL ?? "https://pos.mazettofood.uz";
const platform = process.env.MAZETTO_PLATFORM_URL ?? "https://admin.mazetto.uz";
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
  /*
   * Biznes sozlamalari — 2026-09-10 dan beri tekshiriladi.
   *
   * O'sha kuni yangi kod prod'ga MIGRATSIYASIZ chiqdi: `settings` jadvali
   * yo'qligidan bu endpoint 500 qaytardi, smoke esa 18/18 yashil edi.
   * Sozlamani mijoz autentifikatsiyasi, buyurtma dvigateli va Telegram oqimi
   * ham o'qiydi (SettingsService.readAll), ya'ni bu bitta sahifaning emas,
   * buyurtma yo'lining nosozligi. Kod prod'da yangi, migratsiya esa
   * qo'llanmagan holat aynan shu tekshiruvda ko'rinadi.
   */
  {
    name: "API biznes sozlamalari",
    url: `${api}/settings/public`,
    status: [200],
    body: (text) => text.includes('"success":true'),
  },
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
    name: "kuryerlar tokensiz yopiq",
    url: `${api}/couriers`,
    status: [401],
  },
  {
    name: "dead-letter'lar tokensiz yopiq",
    url: `${api}/notifications/dead-letters`,
    status: [401],
  },
  {
    name: "mijoz buyurtmalari tokensiz yopiq",
    url: `${api}/customer/me/orders`,
    status: [401],
  },
  { name: "customer-web health", url: `${web}/api/health`, status: [200] },
  { name: "www customer-web health", url: `${www}/api/health`, status: [200] },
  ...["/", "/menu", "/cart", "/checkout", "/orders", "/profile"].map(
    (path) => ({
      name: `customer-web ${path}`,
      url: `${web}${path}`,
      status: [200],
    }),
  ),
  {
    name: "www customer-web checkout auth",
    url: `${www}/checkout?auth=1`,
    status: [200],
  },
  { name: "pos-web health", url: `${pos}/api/health`, status: [200] },
  { name: "pos-web /login", url: `${pos}/login`, status: [200] },
  {
    name: "pos-web /admin/dashboard",
    url: `${pos}/admin/dashboard`,
    status: [200],
  },
  { name: "BestTeam owner login", url: `${platform}/login`, status: [200] },
  /*
   * Yangi admin sahifasi. 404 qaytarsa pos-web `main` dan ORQADA qolgan —
   * backend yangilanib, web yangilanmagan holatni ko'rsatadi.
   */
  {
    name: "pos-web /admin/settings",
    url: `${pos}/admin/settings`,
    status: [200],
  },
  { name: "media health", url: `${media}/healthz`, status: [200, 204] },
  {
    name: "customer catalog media assets",
    custom: async () => {
      const getCatalog = (resource) =>
        fetchWithTransientRetry(
          `${api}/customer/menu/${resource}`,
          {
            headers: { "User-Agent": "mazetto-release-smoke" },
          },
          { timeoutMs: 30000 },
        );
      const [productResponse, categoryResponse] = await Promise.all([
        getCatalog("products"),
        getCatalog("categories"),
      ]);
      if (!productResponse.ok)
        return `${productResponse.status}, mahsulot katalogi olinmadi`;
      if (!categoryResponse.ok)
        return `${categoryResponse.status}, kategoriya katalogi olinmadi`;

      const [productPayload, categoryPayload] = await Promise.all([
        productResponse.json(),
        categoryResponse.json(),
      ]);
      const products = Array.isArray(productPayload?.data)
        ? productPayload.data
        : [];
      const categories = Array.isArray(categoryPayload?.data)
        ? categoryPayload.data
        : [];
      if (products.length === 0) return "mahsulot katalogi bo'sh yoki noto'g'ri";
      if (categories.length === 0) return "kategoriya katalogi bo'sh yoki noto'g'ri";

      const assets = [
        ...categories.map((category) => ({
          name: `Kategoriya ${category?.name ?? "noma'lum"}`,
          imageUrl: category?.imageUrl,
        })),
        ...products.map((product) => ({
          name: `Mahsulot ${product?.name ?? "noma'lum"}`,
          imageUrl: product?.imageUrl,
        })),
      ];
      const failures = new Array(assets.length);
      let nextAsset = 0;
      const checkNextAsset = async () => {
        while (nextAsset < assets.length) {
          const index = nextAsset++;
          const asset = assets[index];
          const image =
            typeof asset?.imageUrl === "string"
              ? asset.imageUrl.trim()
              : "";
          if (!image) {
            failures[index] = `${asset.name}: imageUrl yo'q`;
            continue;
          }

          let imageUrl;
          try {
            imageUrl = resolveMediaAssetUrl(image, media);
          } catch (error) {
            failures[index] = `${asset.name}: ${error.message ?? "media URL noto'g'ri"}`;
            continue;
          }
          try {
            const imageResponse = await fetchWithTransientRetry(
              imageUrl,
              {
                method: "HEAD",
                redirect: "manual",
              },
              { timeoutMs: 30000 },
            );
            if (imageResponse.status !== 200) {
              failures[index] = `${asset.name}: HTTP ${imageResponse.status}`;
              await imageResponse.body?.cancel();
            }
          } catch (error) {
            const reason = error.cause?.code ?? error.name ?? "network error";
            failures[index] = `${asset.name}: ${reason}`;
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(2, assets.length) }, () =>
          checkNextAsset(),
        ),
      );

      const failedImages = failures.filter(Boolean);
      return failedImages.length
        ? `${failedImages.length}/${assets.length} media xatosi: ${failedImages.slice(0, 3).join("; ")}`
        : null;
    },
  },
];

async function run(check) {
  if (check.custom) {
    try {
      return await check.custom();
    } catch (error) {
      return `tekshiruv yiqildi (${error.cause?.code ?? error.name})`;
    }
  }

  try {
    const response = await fetchWithTransientRetry(
      check.url,
      {
        headers: { "User-Agent": "mazetto-release-smoke" },
        // Yo'naltirish ham xato: masalan /orders login'ga otib yuborsa, 200 emas.
        redirect: "manual",
      },
      { timeoutMs: 15000 },
    );
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
    console.log(
      `  FAIL ${check.name} — ${problem}\n       ${check.url ?? "rasm URL ro'yxati"}`,
    );
    failed += 1;
  }
}

console.log(`\n${checks.length - failed}/${checks.length} tekshiruv o'tdi`);

// `process.exit()` EMAS: Windows'da ochiq fetch ulanishi bilan chaqirilsa Node
// libuv assertion bilan qulaydi va chiqish kodi 1 emas, 127 bo'lib qoladi.
if (failed > 0) {
  process.exitCode = 1;
}
