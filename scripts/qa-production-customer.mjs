/* global localStorage, sessionStorage, document, window, getComputedStyle */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = globalThis.process.env.QA_BASE || "https://mazettofood.uz";
assert(["https://mazettofood.uz", "http://127.0.0.1:3100"].includes(base));
const output = ".qa-screenshots/production-customer";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [],
  checks = [],
  blocked = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      permissions: ["geolocation"],
      geolocation: { latitude: 41.3159, longitude: 69.2812, accuracy: 20 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("mazetto.customer.splash.seen", "1"),
    );
    await context.route("**/*", (route) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
        const url = new URL(route.request().url());
        // Block analytics too, but do not classify its beacon as an order mutation.
        if (
          !(
            url.origin === new URL(base).origin &&
            url.pathname === "/cdn-cgi/rum"
          )
        )
          blocked.push(url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/menu");
    const add = page.getByRole("button", { name: /savatga qo'shish/ }).first();
    await add.waitFor();
    await page.screenshot({ path: output + "/menu-" + width + ".png" });
    await add.click();
    const dialog = page.getByRole("dialog");
    await dialog
      .locator(".leaflet-tile-loaded")
      .first()
      .waitFor({ timeout: 30000 });
    assert.equal(
      await dialog
        .locator(".mf-fulfillment-header")
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(0, 79, 85)",
    );
    await dialog
      .getByRole("button", { name: "Joylashuvimni aniqlash", exact: true })
      .click();
    await dialog.getByText("Nuqta belgilandi", { exact: true }).waitFor();
    await page.waitForFunction(
      () => {
        const tiles = [
          ...document.querySelectorAll('dialog img.leaflet-tile[src*="/17/"]'),
        ];
        return (
          tiles.length > 0 &&
          tiles.every(
            (tile) =>
              tile.complete &&
              tile.naturalWidth > 0 &&
              tile.classList.contains("leaflet-tile-loaded"),
          )
        );
      },
      null,
      { timeout: 30000 },
    );
    await page.screenshot({ path: output + "/gps-" + width + ".png" });
    await dialog
      .getByLabel("Ko'cha yoki mahalla", { exact: true })
      .fill("Sinov manzili (buyurtma yuborilmaydi)");
    await dialog.getByLabel("Uy / bino", { exact: true }).fill("QA");
    await dialog
      .getByRole("button", { name: "Manzilni tasdiqlash", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    const state = await page.evaluate(() => ({
      cart: JSON.parse(localStorage.getItem("mazetto.customer.cart")),
      selected: JSON.parse(
        sessionStorage.getItem("mazetto.customer.fulfillment.guest"),
      ),
    }));
    assert.equal(state.cart.length, 1);
    assert.equal(state.selected.selection.location.latitude, 41.3159);
    assert.equal(state.selected.selection.location.source, "gps");
    await page.reload();
    await page
      .getByRole("button", { name: /savatga qo'shish/ })
      .first()
      .click();
    assert.equal(await dialog.count(), 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await context.close();
    checks.push(
      width +
        "px: real catalog, themed dialog, browser GPS, guest address persistence, reload and second add",
    );
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(
    blocked,
    [],
    "Guest selection never sends production mutations",
  );
  await writeFile(
    output + "/results.json",
    JSON.stringify({ base, checks, errors, blocked }, null, 2),
  );
  globalThis.console.log(
    JSON.stringify({ base, checks, errors, blocked }, null, 2),
  );
} finally {
  await browser.close();
}
