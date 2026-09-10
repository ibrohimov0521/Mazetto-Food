/* global console, localStorage, document, window, sessionStorage */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { URL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:3100";
const output = ".qa-screenshots/fulfillment";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [],
  checks = [];
const fixtureBranch = {
  id: "qa-branch",
  name: "Mazetto Food",
  address: "Amir Temur ko'chasi, 12",
  coordinates: { latitude: 41.3111, longitude: 69.2797 },
  acceptsOrders: true,
  deliveryEnabled: true,
  pickupEnabled: true,
};
let saved = [
  {
    id: "qa-saved",
    label: "Ish",
    location: {
      latitude: 41.3123,
      longitude: 69.28,
      source: "map",
      address: "Mustaqillik ko'chasi",
      house: "42",
      apartment: "",
      entrance: "",
      floor: "",
      landmark: "",
    },
    updatedAt: new Date().toISOString(),
  },
];
let mutations = [];
const orderPayloads = [];
let failBranches = false;
const session = {
  id: "qa-customer",
  name: "Sinov mijoz",
  phone: "+998900000000",
  accessToken: "qa-only",
  refreshToken: "qa-only",
  tokenType: "Bearer",
};
async function context(width = 390) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    geolocation: { latitude: 41.3159, longitude: 69.2812, accuracy: 20 },
    permissions: ["geolocation"],
  });
  await ctx.route("**/api/v1/**", (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
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
    if (path.endsWith("/customer/branches"))
      return failBranches
        ? json("Filiallar yuklanmadi", 503)
        : json([fixtureBranch]);
    if (path.endsWith("/customer/checkout/quote"))
      return json({
        subtotal: "72000",
        deliveryFee: "0",
        total: "72000",
        paymentMethods: [{ code: "CASH", label: "Naqd", status: "AVAILABLE" }],
      });
    if (path.includes("/customer/me/addresses")) {
      if (req.method() === "GET") return json(saved);
      mutations.push(path);
      if (req.method() === "PUT") {
        const entry = {
          id: path.split("/").at(-1),
          ...req.postDataJSON(),
          updatedAt: new Date().toISOString(),
        };
        saved = [entry, ...saved.filter((a) => a.id !== entry.id)];
        return json(entry);
      }
      if (req.method() === "DELETE") {
        saved = saved.filter((a) => a.id !== path.split("/").at(-1));
        return json({ deleted: true });
      }
    }
    if (path.endsWith("/customer/orders") && req.method() === "POST") {
      orderPayloads.push(req.postDataJSON());
      return json("QA order blocked", 503);
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) {
      mutations.push(path);
      return json("QA order blocked", 503);
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return { ctx, page };
}
async function image(page, name) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  const dialog = page.getByRole("dialog");
  if (await dialog.count()) {
    const box = await dialog.boundingBox();
    assert(box.x >= 0 && box.width <= page.viewportSize().width + 1);
    assert(box.y >= 0 && box.y + box.height <= page.viewportSize().height + 1);
  }
  await page.screenshot({ path: output + "/" + name + ".png" });
}
async function enterAddress(page, house = "12A") {
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Joylashuvimni aniqlash" }).click();
  await d.getByText("Nuqta belgilandi", { exact: true }).waitFor();
  await d
    .getByLabel("Ko'cha yoki mahalla", { exact: true })
    .fill("Amir Temur ko'chasi");
  await d.getByLabel("Uy / bino", { exact: true }).fill(house);
  await d
    .getByRole("button", { name: "Manzilni tasdiqlash", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
}
try {
  const { ctx, page } = await context();
  await page.goto(base + "/menu");
  const add = page.getByRole("button", { name: /savatga qo'shish/ }).first();
  await add.waitFor();
  const initialFocus = await add.getAttribute("aria-label");
  await add.click();
  await page
    .getByRole("dialog", { name: "Qabul qilish turini tanlang" })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mazetto.customer.cart") ?? "[]")
          .length,
    ),
    0,
    "Do not add until confirmation",
  );
  assert.equal(
    await page.evaluate(() => document.body.style.overflow),
    "hidden",
  );
  await page
    .getByRole("button", { name: "Oynani yopish", exact: true })
    .click();
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    initialFocus,
  );
  await add.click();
  await page
    .getByRole("dialog")
    .locator(".leaflet-tile-loaded")
    .first()
    .waitFor({ timeout: 20000 });
  await image(page, "new-mobile");
  await enterAddress(page);
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("mazetto.customer.cart") ?? "[]")
        .length === 1,
  );
  assert.equal(mutations.length, 0, "Guest address writes stay in browser");
  const cart = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mazetto.customer.cart")),
  );
  assert.equal(cart[0].quantity, 1);
  await page
    .getByRole("button", { name: /savatga qo'shish/ })
    .first()
    .click();
  assert.equal(
    await page.getByRole("dialog").count(),
    0,
    "No repeat prompt during current order",
  );
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("mazetto.customer.cart") ?? "[]")
        .length === 2,
  );
  await page.evaluate(
    (session) =>
      localStorage.setItem("mazetto.customer.session", JSON.stringify(session)),
    session,
  );
  await page.goto(base + "/checkout");
  await page.locator(".mf-selected-fulfillment").waitFor();
  assert(
    (await page.locator(".mf-selected-fulfillment").innerText()).includes(
      "12A",
    ),
  );
  assert.equal(
    await page.locator(".mf-map-canvas").count(),
    0,
    "Checkout stays compact",
  );
  await image(page, "checkout-mobile");
  await page.getByRole("button", { name: "O'zgartirish", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Manzilni almashtirish", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Shu manzilga", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert(
    (await page.locator(".mf-selected-fulfillment").innerText()).includes("42"),
  );
  await page.getByRole("button", { name: "Tasdiqlash", exact: true }).click();
  await page.getByText("QA order blocked", { exact: true }).first().waitFor();
  assert.equal(orderPayloads.length, 1);
  assert.equal(orderPayloads[0].deliveryLocation.house, "42");
  await page.getByRole("button", { name: "Tasdiqlash", exact: true }).click();
  await page.waitForTimeout(250);
  assert.equal(orderPayloads.length, 2);
  assert.equal(
    orderPayloads[0].idempotencyKey,
    orderPayloads[1].idempotencyKey,
  );
  await page.reload();
  await page.locator(".mf-selected-fulfillment").waitFor();
  assert(
    (await page.locator(".mf-selected-fulfillment").innerText()).includes("42"),
  );
  await page.getByRole("button", { name: "O'zgartirish", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Olib ketish", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Shu filialdan olaman", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert(
    (await page.locator(".mf-selected-fulfillment").innerText()).includes(
      "Mazetto Food",
    ),
  );
  await page
    .getByRole("heading", { name: "Olib ketish", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Tasdiqlash", exact: true }).click();
  await page.waitForTimeout(250);
  assert(!("deliveryLocation" in orderPayloads.at(-1)));
  assert(!("address" in orderPayloads.at(-1)));
  checks.push(
    "First add is gated; cancel and focus restoration; guest saved address; second item adds directly; chosen location survives login and reload; saved-account address replacement; pickup",
  );
  await ctx.close();

  const guest = await context(360);
  await guest.page.addInitScript(() => {
    localStorage.setItem(
      "mazetto.customer.guestAddresses.v1",
      JSON.stringify([
        {
          id: "guest-home",
          label: "Uy",
          location: {
            latitude: 41.3159,
            longitude: 69.2812,
            source: "map",
            address: "Amir Temur ko'chasi",
            house: "7",
            apartment: "",
            entrance: "",
            floor: "",
            landmark: "",
          },
          updatedAt: "2026-09-07",
        },
      ]),
    );
  });
  await guest.page.goto(base + "/menu");
  await guest.page
    .getByRole("button", { name: /savatga qo'shish/ })
    .first()
    .click();
  await guest.page
    .getByText("Buyurtmani shu manzilga yetkazaylikmi?", { exact: true })
    .waitFor();
  await image(guest.page, "saved-mobile");
  await guest.page.keyboard.press("Escape");
  assert.equal(await guest.page.getByRole("dialog").count(), 0);
  checks.push(
    "Returning guest sees saved address; Escape closes and preserves cart",
  );
  await guest.ctx.close();

  for (const width of [320, 390, 768, 1440]) {
    const preview = await context(width);
    await preview.page.goto(base + "/checkout/preview");
    await preview.page
      .getByRole("button", { name: "Savatga qo'shish", exact: true })
      .click();
    const d = preview.page.getByRole("dialog");
    await d.locator(".leaflet-tile-loaded").first().waitFor({ timeout: 20000 });
    await image(preview.page, "preview-" + width);
    await enterAddress(preview.page, "88");
    await preview.page.locator(".mf-selected-fulfillment").waitFor();
    assert(
      (
        await preview.page.locator(".mf-selected-fulfillment").innerText()
      ).includes("88"),
    );
    await preview.page.reload();
    await preview.page.locator(".mf-selected-fulfillment").waitFor();
    assert(
      (
        await preview.page.locator(".mf-selected-fulfillment").innerText()
      ).includes("88"),
    );
    await preview.ctx.close();
  }
  checks.push(
    "Login-free preview demonstrates same modal and checkout selection at 320/390/768/1440",
  );
  const retry = await context();
  failBranches = true;
  await retry.page.goto(base + "/menu");
  await retry.page
    .getByRole("button", { name: /savatga qo'shish/ })
    .first()
    .click();
  await retry.page
    .getByRole("dialog")
    .getByRole("button", { name: "Qayta urinish", exact: true })
    .waitFor();
  failBranches = false;
  await retry.page
    .getByRole("dialog")
    .getByRole("button", { name: "Qayta urinish", exact: true })
    .click();
  await retry.page
    .getByRole("dialog")
    .getByRole("button", { name: "Joylashuvimni aniqlash" })
    .waitFor();
  await retry.ctx.close();
  checks.push("Branch loading failure has retry; no real orders sent");
  const restored = await context();
  await restored.page.addInitScript((cart) => {
    localStorage.setItem("mazetto.customer.cart", JSON.stringify(cart));
  }, cart);
  await restored.page.goto(base + "/menu");
  const stepper = restored.page.locator(".mf-product-stepper").first();
  await stepper.getByRole("button").first().click();
  await stepper.getByRole("button", { name: / qo'shish$/ }).click();
  await restored.page.getByRole("dialog").waitFor();
  assert.equal(
    await restored.page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mazetto.customer.cart"))[0].quantity,
    ),
    1,
  );
  await restored.page
    .getByRole("button", { name: "Oynani yopish", exact: true })
    .click();
  assert.equal(
    await restored.page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mazetto.customer.cart"))[0].quantity,
    ),
    1,
  );
  await stepper.getByRole("button", { name: / qo'shish$/ }).click();
  await restored.page
    .getByRole("dialog")
    .getByRole("button", { name: "Olib ketish", exact: true })
    .click();
  await restored.page
    .getByRole("button", { name: "Shu filialdan olaman", exact: true })
    .click();
  await restored.page.getByRole("dialog").waitFor({ state: "hidden" });
  await restored.page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("mazetto.customer.cart"))[0].quantity ===
      2,
  );
  await restored.ctx.close();
  checks.push(
    "Restored cart quantity increase requires address confirmation and applies exactly once; cancel preserves quantity",
  );

  const detail = await context();
  await detail.page.goto(base + "/product/" + cart[0].productId);
  const detailAdd = detail.page.getByRole("button", {
    name: /Savatchaga qo'shish/,
  });
  await detailAdd.click();
  await detail.page.getByRole("dialog").waitFor();
  await detail.page
    .getByRole("button", { name: "Oynani yopish", exact: true })
    .click();
  assert.equal(
    await detail.page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mazetto.customer.cart") ?? "[]")
          .length,
    ),
    0,
  );
  await detailAdd.click();
  await detail.page
    .getByRole("dialog")
    .getByRole("button", { name: "Olib ketish", exact: true })
    .click();
  await detail.page
    .getByRole("button", { name: "Shu filialdan olaman", exact: true })
    .click();
  await detail.page.getByRole("dialog").waitFor({ state: "hidden" });
  await detail.page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("mazetto.customer.cart") ?? "[]")
        .length === 1,
  );
  await detail.ctx.close();
  checks.push(
    "Product detail add opens the same dialog; cancellation is non-mutating and confirmation adds once",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, pageErrors: errors }, null, 2));
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, pageErrors: errors }, null, 2),
  );
} finally {
  await browser.close();
}
