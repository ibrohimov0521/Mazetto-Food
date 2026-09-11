/* global document, getComputedStyle, localStorage, window */
/*
 * MIJOZ SAYTI — KONTRAST, MAYDA MATN VA GORIZONTAL OQISH TEKSHIRUVI.
 *
 * Nima uchun kerak: kontrast nisbatlarini manbadan hisoblash mumkin,
 * lekin haqiqiy fon KASKADDAN kelib chiqadi — shaffof qatlamlar,
 * gradientlar va ota elementning foni. Manbaga qarab "o'tadi" degan
 * juftlik brauzerda o'tmasligi mumkin, va aksincha.
 *
 * Ishlatish (avval `next build` qilib, keyin preview'ni ishga tushirish):
 *   node scripts/qa-customer-contrast.mjs
 *   QA_BASE=http://127.0.0.1:3107 node scripts/qa-customer-contrast.mjs
 *
 * MA'LUM CHEKLOV: fon topuvchi faqat 95% dan zich rangni qabul qiladi,
 * shuning uchun RASM yoki GRADIENT ustidagi matn xato "o'tmadi" deb
 * belgilanadi (`wide`/`contrast` ro'yxatida shu sabab `note` bor).
 * Bunday holatlar qo'lda tekshirilishi kerak.
 *
 * `overflow` ro'yxatida `doc === client` bo'lsa, sahifada haqiqiy
 * gorizontal aylantirish YO'Q — bu faqat kesilgan konteyner ichidagi
 * `object-contain` rasm.
 */
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = (globalThis.process.env.QA_BASE || "http://127.0.0.1:3107").replace(
  /\/$/,
  "",
);
const host = new URL(base).hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
  throw new Error("Faqat mahalliy preview: QA_BASE localhost bo'lishi kerak");
}
const widths = [375, 390, 430, 768, 1024, 1366, 1440];
const routes = ["/", "/menu", "/cart", "/checkout", "/orders", "/profile"];
const outDir = fileURLToPath(new URL("../.qa-screenshots/", import.meta.url));
await mkdir(outDir, { recursive: true });

// ---- contrast helpers, evaluated in the page ----
const contrastProbe = () => {
  const parse = (value) => {
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(",").map((piece) => Number(piece.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (fg, bg) =>
    fg.a >= 1
      ? fg
      : {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1,
        };
  const effectiveBg = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.95) return bg;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const results = [];
  const seen = new Set();
  const nodes = document.querySelectorAll(
    "p, span, h1, h2, h3, h4, a, button, li, dt, dd, small, strong, label",
  );
  for (const el of nodes) {
    const text = (el.textContent || "").trim();
    // Only leaf-ish nodes with their own visible text.
    if (!text || el.children.length > 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.opacity === "0") continue;
    const fg = parse(style.color);
    if (!fg || fg.a === 0) continue;
    const bg = effectiveBg(el);
    const r = ratio(over(fg, bg), bg);
    const px = parseFloat(style.fontSize);
    const weight = Number(style.fontWeight) || 400;
    const large = px >= 24 || (px >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const key = `${style.color}|${px}|${weight}|${text.slice(0, 24)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (r < need) {
      results.push({
        text: text.slice(0, 48),
        color: style.color,
        px,
        weight,
        ratio: Number(r.toFixed(2)),
        need,
      });
    }
  }
  return results;
};

const tinyTextProbe = () => {
  const found = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("*")) {
    const text = (el.textContent || "").trim();
    if (!text || el.children.length > 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px >= 11) continue;
    const key = `${px}|${text.slice(0, 24)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ text: text.slice(0, 40), px });
  }
  return found;
};

const overflowProbe = () => ({
  doc: document.documentElement.scrollWidth,
  body: document.body.scrollWidth,
  client: document.documentElement.clientWidth,
  wide: [...document.querySelectorAll("*")]
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > document.documentElement.clientWidth + 1;
    })
    .slice(0, 6)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || "").slice(0, 60),
      w: Math.round(el.getBoundingClientRect().width),
    })),
});

const report = { overflow: [], contrast: [], tiny: [], pageErrors: [] };
/*
 * `PLAYWRIGHT_CHROMIUM_PATH` — o'rnatilgan brauzer buildi Playwright
 * kutganidan farq qilganda ishlatiladi (`npx playwright install`
 * qilmasdan ham tekshirish mumkin bo'lsin). Playwright o'zining
 * vaqtinchalik profilini ochadi, ya'ni foydalanuvchining interaktiv
 * brauzer sessiyasiga tegmaydi.
 */
const executablePath = globalThis.process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("mazetto.customer.splash.seen", "1"),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      report.pageErrors.push({ width, message: error.message }),
    );
    for (const route of routes) {
      await page.goto(`${base}${route}`, { waitUntil: "load" });
      await page.waitForTimeout(600);

      const overflow = await page.evaluate(overflowProbe);
      if (
        overflow.doc > overflow.client + 1 ||
        overflow.body > overflow.client + 1 ||
        overflow.wide.length
      ) {
        report.overflow.push({ width, route, ...overflow });
      }

      // Contrast and tiny text only need a couple of widths.
      if (width === 390 || width === 1440) {
        const fails = await page.evaluate(contrastProbe);
        if (fails.length) report.contrast.push({ width, route, fails });
        const tiny = await page.evaluate(tinyTextProbe);
        if (tiny.length) report.tiny.push({ width, route, tiny });
      }

      if (width === 390) {
        await page.screenshot({
          path: `${outDir}/${route.replace(/\//g, "_") || "_home"}-390.png`,
          fullPage: false,
        });
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  `${outDir}/report.json`,
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log("overflow issues:", report.overflow.length);
console.log("contrast failures:", report.contrast.length);
console.log("tiny text spots:", report.tiny.length);
console.log("page errors:", report.pageErrors.length);
for (const entry of report.overflow)
  console.log(
    ` OVERFLOW ${entry.route} @${entry.width}: doc=${entry.doc} client=${entry.client}`,
    JSON.stringify(entry.wide),
  );
for (const entry of report.contrast)
  for (const fail of entry.fails)
    console.log(
      ` CONTRAST ${entry.route} @${entry.width}: ${fail.ratio} (need ${fail.need}) ${fail.px}px/${fail.weight} ${fail.color} "${fail.text}"`,
    );
for (const entry of report.tiny)
  for (const t of entry.tiny)
    console.log(` TINY ${entry.route} @${entry.width}: ${t.px}px "${t.text}"`);
for (const e of report.pageErrors)
  console.log(` PAGEERROR @${e.width}: ${e.message}`);

/*
 * CHIQISH KODI faqat SHUBHASIZ muammolarda nolga teng bo'lmaydi:
 * haqiqiy gorizontal aylantirish, mayda matn va sahifa xatosi.
 * Kontrast ro'yxati qo'lda ko'rib chiqiladi, chunki yuqoridagi
 * cheklov tufayli unda yolg'on signal bo'lishi mumkin.
 */
/*
 * CHIQISH KODI faqat SHUBHASIZ muammolarda nolga teng bo'lmaydi:
 * haqiqiy gorizontal aylantirish, mayda matn va sahifa xatosi.
 * Kontrast ro'yxati qo'lda ko'rib chiqiladi, chunki yuqoridagi
 * cheklov tufayli unda yolg'on signal bo'lishi mumkin.
 */
const realOverflow = report.overflow.filter(
  (entry) => entry.doc > entry.client + 1 || entry.body > entry.client + 1,
);
const failed =
  realOverflow.length + report.tiny.length + report.pageErrors.length;
console.log("");
if (failed) {
  console.error(
    `TEKSHIRUV O'TMADI: ${realOverflow.length} oqish, ${report.tiny.length} mayda matn, ${report.pageErrors.length} sahifa xatosi`,
  );
  globalThis.process.exitCode = 1;
} else {
  console.log("O'TDI: gorizontal oqish, mayda matn va sahifa xatosi topilmadi.");
}
