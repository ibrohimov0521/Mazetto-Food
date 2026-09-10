/* global console, document, window, localStorage, sessionStorage, process, structuredClone, URL, getComputedStyle */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const base = process.argv[2] || "http://127.0.0.1:3102";
const output = ".qa-screenshots/checkout-returning";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const checks = [];
const session = {
  id: "qa-returning",
  name: "Sinov mijoz",
  phone: "+998900000000",
  accessToken: "qa-only",
  refreshToken: "qa-only",
  tokenType: "Bearer",
};
const branch = {
  id: "qa-branch",
  name: "MAZETTO Sergeli",
  address: "Sergeli 7/3",
  acceptsOrders: true,
  deliveryEnabled: true,
  pickupEnabled: true,
  coordinates: { latitude: 41.3111, longitude: 69.2797 },
};
const location = {
  latitude: 41.3123,
  longitude: 69.28,
  source: "map",
  address: "Sergeli 7/3/28",
  house: "3",
  apartment: "",
  entrance: "",
  floor: "",
  landmark: "",
};
const selection = {
  type: "DELIVERY",
  branchId: branch.id,
  branchName: branch.name,
  branchAddress: branch.address,
  location,
};
const initialAddress = {
  id: "qa-home",
  label: "Uy",
  location,
  updatedAt: "2026-09-08",
};
const item = {
  key: "qa-lavash",
  productId: "qa-product",
  productName: "Tandir lavash juftligi",
  unitPrice: "117000",
  quantity: 1,
  modifiers: [],
  imageUrl:
    "https://media.mazettofood.uz/products/set-tandir-lavash-juftligi.webp",
};
const cart = Array.from({ length: 8 }, (_, index) => ({
  ...item,
  key: "qa-" + index,
  productName: index % 2 ? "Katlet podamashni juftligi" : item.productName,
}));

async function setup(width, options = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height: 850 },
    geolocation: { latitude: 41.3159, longitude: 69.2812, accuracy: 20 },
    permissions: ["geolocation"],
  });
  let saved = options.saved === false ? [] : [structuredClone(initialAddress)];
  const orders = [];
  const mutations = [];
  await ctx.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    const json = (data) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: true, data }),
      });
    if (path.endsWith("/customer/branches")) return json([branch]);
    if (path.endsWith("/customer/checkout/quote"))
      return json({
        subtotal: "936000",
        deliveryFee: "10000",
        total: "946000",
        paymentMethods: [{ code: "CASH", label: "Naqd", status: "AVAILABLE" }],
      });
    if (path.endsWith("/customer/me/orders/qa-created"))
      return json({
        id: "qa-created",
        status: "NEW",
        type: "DELIVERY",
        createdAt: new Date().toISOString(),
        branch,
        order: {
          orderNumber: "QA-1",
          total: "946000",
          status: "NEW",
          items: [],
        },
      });
    if (path.includes("/customer/me/addresses")) {
      if (req.method() === "GET") return json(saved);
      mutations.push(req.method());
      const id = path.split("/").at(-1);
      if (req.method() === "PUT") {
        const entry = {
          id,
          ...req.postDataJSON(),
          updatedAt: new Date().toISOString(),
        };
        saved = [entry, ...saved.filter((entry) => entry.id !== id)];
        return json(entry);
      }
      saved = saved.filter((entry) => entry.id !== id);
      return json({ deleted: true });
    }
    if (path.endsWith("/customer/orders") && req.method() === "POST") {
      orders.push(req.postDataJSON());
      return json({ customerOrder: { id: "qa-created" }, order: null });
    }
    if (req.method() !== "GET") return route.abort();
    if (path.includes("/customer/orders")) return json([]);
    try {
      return await route.fulfill({ response: await route.fetch() });
    } catch (error) {
      if (!/disposed|closed|cancelled/.test(error.message)) throw error;
    }
  });
  const page = await ctx.newPage();
  page.on("pageerror", (error) => failures.push(error.message));
  await ctx.addInitScript(
    ({ session, cart, selection, options }) => {
      if (localStorage.getItem("qa-fixture-seeded")) return;
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("qa-fixture-seeded", "1");
      if (!options.guest)
        localStorage.setItem(
          "mazetto.customer.session",
          JSON.stringify(session),
        );
      localStorage.setItem(
        "mazetto.customer.cart",
        JSON.stringify(options.empty ? [] : cart),
      );
      if (options.legacy)
        sessionStorage.setItem(
          "mazetto.customer.fulfillment." + session.id,
          JSON.stringify({ selection, confirmed: false }),
        );
      else if (!options.noSelection)
        localStorage.setItem(
          "mazetto.customer.fulfillment." +
            (options.guest ? "guest" : session.id),
          JSON.stringify({ selection, confirmed: true }),
        );
      if (options.guest && options.saved !== false)
        localStorage.setItem(
          "mazetto.customer.guestAddresses.v1",
          JSON.stringify([
            { id: "guest-home", label: "Uy", location: selection.location },
          ]),
        );
    },
    { session, cart, selection, options },
  );
  return { ctx, page, orders, mutations, addresses: () => saved };
}
async function screenshot(page, name) {
  await page.waitForTimeout(500);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    "No horizontal overflow: " + name,
  );
  await page.screenshot({ path: `${output}/${name}.png` });
}
async function barCheck(page) {
  const bar = page.getByRole("region", { name: "Buyurtmani yakunlash" });
  await bar.waitFor().catch(async (error) => {
    console.log(
      await page.evaluate(() => ({
        cart: localStorage.getItem("mazetto.customer.cart"),
        text: document.body.innerText.slice(0, 800),
      })),
    );
    await page.screenshot({ path: output + "/bar-missing.png" });
    throw error;
  });
  for (const position of [0, 450, 10000]) {
    await page.evaluate((y) => window.scrollTo(0, y), position);
    const rect = await bar.boundingBox();
    assert(
      rect.y >= 0 && rect.y + rect.height <= page.viewportSize().height,
      "Action visible while scrolling",
    );
    const contentWidth = await page.evaluate(() =>
      Math.min(document.documentElement.clientWidth, document.body.clientWidth),
    );
    if (Math.abs(rect.x + rect.width / 2 - contentWidth / 2) >= 2) {
      console.log({
        rect,
        contentWidth,
        viewport: page.viewportSize(),
        position,
        styles: await bar.evaluate((el) => ({
          transform: getComputedStyle(el).transform,
          left: getComputedStyle(el).left,
          zoom: getComputedStyle(document.body).zoom,
        })),
      });
      await page.screenshot({ path: output + "/bar-position.png" });
    }
    assert(
      Math.abs(rect.x + rect.width / 2 - contentWidth / 2) < 2,
      "Action centered within viewport excluding scrollbar",
    );
    const button = bar.locator("a,button");
    const box = await button.boundingBox();
    assert(box.width >= 100 && box.height >= 44, "Touch target");
    assert(
      await button.evaluate((el) => el.scrollWidth <= el.clientWidth),
      "Button text fits",
    );
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
try {
  for (const width of (process.env.QA_WIDTHS || "320,390,768,1440")
    .split(",")
    .map(Number)) {
    const test = await setup(width, { legacy: width === 390 });
    const { page, ctx } = test;
    await page.goto(base + "/cart");
    await barCheck(page);
    await screenshot(page, `cart-${width}`);
    await page
      .getByRole("link", { name: "Rasmiylashtirish", exact: true })
      .click();
    await page.locator(".mf-selected-fulfillment").waitFor();
    await barCheck(page);
    await screenshot(page, `checkout-${width}`);
    await page
      .getByRole("button", { name: "O'zgartirish", exact: true })
      .click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: "Uy manzilini o'chirish" }).waitFor();
    await d
      .getByRole("button", { name: "Yangi manzil", exact: true })
      .waitFor();
    assert.equal(
      await d
        .getByRole("button", { name: "Shu manzilga", exact: true })
        .count(),
      1,
    );
    await screenshot(page, `addresses-${width}`);
    if (width === 390) {
      await d
        .getByRole("button", { name: "Yangi manzil", exact: true })
        .click();
      await d.getByRole("button", { name: "Joylashuvimni aniqlash" }).click();
      await d.getByText("Nuqta belgilandi", { exact: true }).waitFor();
      await d
        .getByLabel("Ko'cha yoki mahalla", { exact: true })
        .fill("Amir Temur ko'chasi");
      await d.getByLabel("Uy / bino", { exact: true }).fill("42");
      await d.getByRole("button", { name: "Ish", exact: true }).click();
      await screenshot(page, "new-address-mobile");
      await d
        .getByRole("button", { name: "Manzilni tasdiqlash", exact: true })
        .click();
      await d.waitFor({ state: "hidden" });
      assert.equal(
        test.addresses().length,
        2,
        "Second address saved separately",
      );
      assert.match(
        await page.locator(".mf-selected-fulfillment").innerText(),
        /42/,
      );
      await page
        .getByRole("button", { name: "O'zgartirish", exact: true })
        .click();
      await d.getByRole("button", { name: "Uy manzilini o'chirish" }).click();
      await d.getByRole("button", { name: "O'chirish", exact: true }).click();
      await d
        .getByRole("button", { name: "Uy manzilini o'chirish" })
        .waitFor({ state: "hidden" });
      assert.equal(test.addresses().length, 1);
      await d
        .getByRole("button", { name: "Shu manzilga", exact: true })
        .click();
      await d.waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "Tasdiqlash", exact: true })
        .click();
      await page.waitForURL("**/order-success/qa-created");
      assert.equal(test.orders.length, 1);
      assert.equal(test.orders[0].deliveryLocation.house, "42");
      assert.equal(test.orders[0].deliveryLocation.latitude, 41.3159);
      const next = await ctx.newPage();
      await next.goto(base + "/menu");
      await next
        .getByRole("button", { name: /savatga qo'shish/i })
        .first()
        .click();
      await next
        .waitForFunction(
          () =>
            JSON.parse(localStorage.getItem("mazetto.customer.cart") || "[]")
              .length > 0,
        )
        .catch(async (error) => {
          console.log(
            await next.evaluate(() => ({
              cart: localStorage.getItem("mazetto.customer.cart"),
              selection: localStorage.getItem(
                "mazetto.customer.fulfillment.qa-returning",
              ),
              dialogs: document.querySelectorAll("dialog").length,
              text: document.body.innerText.slice(-1800),
            })),
          );
          await next.screenshot({ path: output + "/repeat-failure.png" });
          throw error;
        });
      assert.equal(
        await next.getByRole("dialog").count(),
        0,
        "No prompt after order or in new tab",
      );
      checks.push(
        "Address CRUD, mocked geolocation, order coordinates, post-order reuse, new-tab persistence, legacy migration",
      );
    } else {
      await d
        .getByRole("button", { name: "Shu manzilga", exact: true })
        .click();
    }
    checks.push(
      `Cart and checkout fixed bar, immediate address tools, no overflow at ${width}px`,
    );
    await ctx.close();
  }
  for (const guest of [true, false]) {
    const test = await setup(390, { guest, noSelection: true, empty: true });
    await test.page.goto(base + "/menu");
    await test.page
      .getByRole("button", { name: /savatga qo'shish/i })
      .first()
      .click();
    await test.page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("mazetto.customer.cart") || "[]")
          .length > 0,
    );
    assert.equal(
      await test.page.getByRole("dialog").count(),
      0,
      "Saved address automatically restored",
    );
    await test.ctx.close();
  }
  const first = await setup(390, {
    guest: true,
    noSelection: true,
    empty: true,
    saved: false,
  });
  await first.page.goto(base + "/menu");
  await first.page
    .getByRole("button", { name: /savatga qo'shish/i })
    .first()
    .click();
  await first.page.getByRole("dialog").waitFor();
  assert.equal(
    await first.page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mazetto.customer.cart") || "[]")
          .length,
    ),
    0,
  );
  await first.page
    .getByRole("button", { name: "Oynani yopish", exact: true })
    .click();
  await first.ctx.close();
  checks.push(
    "First-time guest prompted; existing guest/account addresses restored without prompt; no real orders sent",
  );
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ checks, pageErrors: failures }, null, 2));
} finally {
  await browser.close();
}
