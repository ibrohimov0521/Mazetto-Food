/* global console, document, localStorage, process, setTimeout, URL, window */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = new URL(process.env.QA_BASE || "http://127.0.0.1:3100");
const api = process.env.QA_API || "http://127.0.0.1:4100/api/v1";
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "Local preview only",
);
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(api).hostname),
  "Local API only",
);
const output = fileURLToPath(
  new URL("../.qa-screenshots/polish/", import.meta.url),
);
await mkdir(output, { recursive: true });
const report = { checks: [], pages: [], pageErrors: [], blockedMutations: [] };
const browser = await chromium.launch({ headless: true });
const session = {
  id: "qa-customer",
  name: "QA Mijoz",
  phone: "+998900000000",
  accessToken: "qa-local-only",
  refreshToken: "qa-local-only",
  tokenType: "Bearer",
  bonusBalance: "0",
};
let fixtureOrders = [];
let fixtureDashboard;
let quoteVersion = 0;
let quoteRace = false;
let failBranches = false;
let failOrders = false;
let failQuote = false;
let refreshAttempts = 0;

async function intercept(context, authenticated = false) {
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(
          status === 200
            ? { success: true, data }
            : { success: false, error: { message: data } },
        ),
      });
    if (url.pathname.endsWith("/auth/refresh")) {
      refreshAttempts++;
      return json("Unexpected refresh", 500);
    }
    if (failBranches && url.pathname.endsWith("/customer/branches"))
      return json("Filiallar vaqtincha ochilmadi", 503);
    if (authenticated && url.pathname.endsWith("/customer/checkout/quote")) {
      if (failQuote) return json("Hisoblash vaqtincha ishlamayapti", 503);
      const version = ++quoteVersion;
      const body = request.postDataJSON();
      if (quoteRace)
        await new Promise((resolve) =>
          setTimeout(resolve, body.type === "DELIVERY" ? 850 : 80),
        );
      return json({
        subtotal: "141000",
        deliveryFee: body.type === "DELIVERY" ? "12000" : "0",
        total: body.type === "DELIVERY" ? "153000" : "141000",
        paymentMethods: [{ code: "CASH", label: "Naqd", status: "AVAILABLE" }],
        version,
      });
    }
    if (authenticated && url.pathname.includes("/customer/me/")) {
      if (failOrders) return json("Serverda vaqtinchalik muammo", 503);
      if (url.pathname.endsWith("/dashboard")) return json(fixtureDashboard);
      if (url.pathname.endsWith("/orders")) return json(fixtureOrders);
      return json(
        fixtureOrders.find((order) => url.pathname.endsWith("/" + order.id)) ??
          "So'ralgan ma'lumot topilmadi.",
        fixtureOrders.some((order) => url.pathname.endsWith("/" + order.id))
          ? 200
          : 404,
      );
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      report.blockedMutations.push(url.pathname);
      return route.abort();
    }
    return route.continue();
  });
}

async function screenshot(page, name) {
  await page.waitForTimeout(400);
  const geometry = await page.evaluate(() => ({
    path: window.location.pathname,
    width: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    brokenImages: [...document.images]
      .filter(
        (image) =>
          image.complete &&
          !image.naturalWidth &&
          image.getBoundingClientRect().width,
      )
      .map((image) => image.src),
    actionHeight: document
      .querySelector(".mf-detail-add")
      ?.getBoundingClientRect().height,
  }));
  assert(!geometry.overflow, `${name}: horizontal overflow`);
  assert.deepEqual(geometry.brokenImages, [], `${name}: broken images`);
  report.pages.push(geometry);
  await page.screenshot({ path: `${output}/${name}-${geometry.width}.png` });
}

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
  });
  await intercept(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  await page.goto(base.href);
  await page.locator("[data-product-card]").first().waitFor();
  assert.equal(await page.locator(".mf-header-logo").count(), 1);
  assert.equal(
    await page.locator(".fixed.inset-0.z-\\[80\\]").count(),
    0,
    "No blocking splash",
  );
  assert(
    (
      await page
        .locator(".mf-home-products [data-product-card]")
        .first()
        .boundingBox()
    ).y < 800,
  );
  const beforeDialog = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await page.locator(".mf-branch-trigger").click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollHeight),
    beforeDialog,
  );
  await page.keyboard.press("Escape");
  assert(
    await page
      .locator(".mf-branch-trigger")
      .evaluate((element) => element === document.activeElement),
  );
  report.checks.push(
    "First visit has no splash lock; branch dialog preserves layout and restores focus",
  );

  await page.goto(new URL("/menu", base).href);
  await page.waitForFunction(
    () => document.querySelectorAll("[data-product-card]").length === 74,
  );
  const first = page.locator("[data-product-card]").first();
  await first.locator(".mf-favorite-button").click();
  await first.getByRole("button", { name: /savatga qo'shish/ }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("mazetto.customer.cart") || "[]")[0]
        ?.quantity === 1,
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-product-card]").length === 74,
  );
  assert.equal(
    await first.locator(".mf-favorite-button").getAttribute("aria-pressed"),
    "true",
  );
  const titleBefore = await first.locator(".mf-product-title").boundingBox();
  await first.locator(".mf-product-stepper button").click();
  await first.getByRole("button", { name: / qo'shish$/ }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("mazetto.customer.cart") || "[]")[0]
        ?.quantity === 2,
  );
  assert.equal(
    (await first.locator(".mf-product-title").boundingBox()).width,
    titleBefore.width,
  );
  assert.match(
    await page
      .locator(".mf-bottom-nav [data-cart-target]")
      .getAttribute("aria-label"),
    /2 ta mahsulot/,
  );
  await page.waitForTimeout(2200);
  assert(
    await first.getByRole("button", { name: / qo'shish$/ }).isVisible(),
    "Focused stepper must not disappear",
  );
  await page
    .getByRole("textbox", { name: "Menyudan qidirish" })
    .count()
    .then(async (count) => {
      await page
        .getByRole(count ? "textbox" : "searchbox", {
          name: "Menyudan qidirish",
        })
        .fill("no-such-meal");
    });
  await page.waitForFunction(
    () => document.querySelectorAll("[data-product-card]").length === 0,
  );
  await page.getByRole("button", { name: "Qidiruvni tozalash" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-product-card]").length === 74,
  );
  const navBefore = await page.locator(".mf-bottom-nav").boundingBox();
  await page.getByRole("button", { name: "Lavashlar", exact: true }).click();
  await page.waitForTimeout(850);
  assert.deepEqual(
    await page.locator(".mf-bottom-nav").boundingBox(),
    navBefore,
  );
  assert(Math.abs((await page.locator(".mf-menu-sticky").boundingBox()).y) < 1);
  report.checks.push(
    "74 products, search/reset, persistent favorites/cart, quantity count, focused stepper and stable sticky navigation",
  );

  const products = (
    await (await context.request.get(`${api}/customer/menu/products`)).json()
  ).data;
  const storedCart = JSON.parse(
    await page.evaluate(() => localStorage.getItem("mazetto.customer.cart")),
  );
  const product = products.find((item) => item.id === storedCart[0].productId);
  const branches = (
    await (await context.request.get(`${api}/customer/branches`)).json()
  ).data;
  const other = products.find(
    (item) => item.id !== product.id && item.variants.length,
  );
  await page.goto(new URL(`/product/${product.id}`, base).href);
  await page.locator(".mf-product-summary h1").waitFor();
  await page.getByRole("button", { name: "Miqdorni oshirish" }).click();
  await page.getByRole("textbox", { name: "Izoh (ixtiyoriy)" }).fill("QA note");
  await page
    .locator(`[data-product-card] a[href="/product/${other.id}"]`)
    .first()
    .click();
  await page.waitForURL(`**/product/${other.id}`);
  await page.locator(".mf-product-summary h1").waitFor();
  assert.equal(
    await page.locator(".mf-detail-quantity output").innerText(),
    "1",
  );
  assert.equal(
    await page.getByRole("textbox", { name: "Izoh (ixtiyoriy)" }).inputValue(),
    "",
  );
  assert(
    (await page.locator(".mf-product-detail-image").boundingBox()).y < 300,
  );
  assert.equal(await page.locator("[data-product-card]").count(), 74);
  const state = await context.storageState();
  await page.goto(new URL("/cart", base).href);
  await page.getByRole("heading", { name: "Savatcha", exact: true }).waitFor();
  await page.waitForFunction(() =>
    document.body.innerText.includes("2 ta mahsulot"),
  );
  await screenshot(page, "cart-functional");
  report.checks.push(
    "Product navigation resets quantity/notes; photo is above fold; full menu remains; saved cart survives route reload",
  );
  await context.close();

  const branch = branches.find(
    (item) => item.acceptsOrders && item.deliveryEnabled && item.pickupEnabled,
  );
  assert(branch, "Need an available branch for both order types");
  const fixture = (id, status) => ({
    id,
    status,
    type: "DELIVERY",
    paymentMethod: "CASH",
    deliveryAddress: "QA manzil",
    createdAt: "2026-09-07T07:00:00.000Z",
    branch,
    order: {
      id: `order-${id}`,
      orderNumber: "MF-QA-001",
      displayOrderNumber: "MF-QA-001",
      status,
      total: "282000",
      subtotal: "282000",
      deliveryFee: "0",
      payments: [],
      items: [
        {
          id: "qa-line",
          productName: product.name,
          variantName: product.variants[0]?.name,
          quantity: "2",
          totalPrice: "282000",
          unitPrice: "141000",
          modifierSnapshot: [],
          notes: "",
        },
      ],
    },
  });
  fixtureOrders = [
    fixture("qa-active", "PREPARING"),
    fixture("qa-completed", "COMPLETED"),
  ];
  fixtureDashboard = {
    ...session,
    customerOrders: fixtureOrders,
    favorites: [{ product }],
  };

  for (const width of [360, 390, 430, 768, 1440]) {
    const ctx = await browser.newContext({
      storageState: state,
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    await ctx.addInitScript(
      ({ session, branchId }) => {
        localStorage.setItem(
          "mazetto.customer.session",
          JSON.stringify(session),
        );
        localStorage.setItem("mazetto.customer.branchId", branchId);
      },
      { session, branchId: branch.id },
    );
    await intercept(ctx, true);
    const p = await ctx.newPage();
    p.on("pageerror", (error) => report.pageErrors.push(error.message));
    for (const route of [
      "/checkout",
      "/profile",
      "/orders",
      "/orders/qa-active",
      "/order-success/qa-active",
    ]) {
      await p.goto(new URL(route, base).href);
      await p.waitForTimeout(900);
      await screenshot(p, route.replaceAll("/", "-").slice(1));
    }
    if (width === 390) {
      quoteRace = true;
      await p.goto(new URL("/checkout", base).href);
      await p
        .getByRole("button", { name: "Olib ketish", exact: true })
        .waitFor();
      await p.getByRole("button", { name: "Olib ketish", exact: true }).click();
      await p.waitForTimeout(1100);
      assert(await p.getByText("Bepul", { exact: true }).isVisible());
      assert.equal(
        await p
          .getByRole("button", { name: "Olib ketish", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      quoteRace = false;
      failQuote = true;
      await p
        .getByRole("button", { name: "Yetkazib berish", exact: true })
        .click();
      await p.getByRole("button", { name: "Qayta hisoblash" }).waitFor();
      assert(
        await p
          .getByRole("button", { name: "Buyurtmani tasdiqlash", exact: true })
          .isDisabled(),
      );
      failQuote = false;
      await p.getByRole("button", { name: "Qayta hisoblash" }).click();
      await p.waitForFunction(
        () =>
          ![...document.querySelectorAll("button")].find(
            (b) => b.textContent === "Buyurtmani tasdiqlash",
          )?.disabled,
      );
      failBranches = true;
      await p.reload();
      await p
        .getByRole("button", { name: "Qayta urinish", exact: true })
        .waitFor();
      failBranches = false;
      await p
        .getByRole("button", { name: "Qayta urinish", exact: true })
        .click();
      await p.locator(".mf-branch-trigger").waitFor();
      failOrders = true;
      await p.goto(new URL("/orders", base).href);
      await p
        .getByRole("heading", { name: "Buyurtmalar yuklanmadi" })
        .waitFor();
      await p.waitForTimeout(700);
      assert.equal(
        refreshAttempts,
        0,
        "Network/5xx failures must not trigger authentication refresh loops",
      );
      failOrders = false;
      report.checks.push(
        "Latest quote wins; quote/branch failures have working retries; 503 order failures do not refresh auth",
      );
    }
    await ctx.close();
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.blockedMutations, []);
  report.checks.push(
    "Authenticated checkout/profile/history/details/success checked at 360/390/430/768/1440 with local fixtures; no real order/auth mutations",
  );
  console.log(
    JSON.stringify(
      {
        checks: report.checks,
        screenshots: report.pages.length,
        pageErrors: report.pageErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
