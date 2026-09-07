/* global window, navigator, document, localStorage, sessionStorage, getComputedStyle */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = "http://127.0.0.1:3100";
const output = ".qa-screenshots/botanical";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const checks = [],
  errors = [];
async function setup(width, mode = "native", accuracy = 20) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    geolocation: { latitude: 41.3159, longitude: 69.2812, accuracy },
    permissions: ["geolocation"],
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) =>
    ["GET", "HEAD", "OPTIONS"].includes(route.request().method())
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((mode) => {
    window.__geoCalls = 0;
    const native = navigator.geolocation.getCurrentPosition.bind(
      navigator.geolocation,
    );
    Object.defineProperty(navigator.geolocation, "getCurrentPosition", {
      value(success, failure, options) {
        window.__geoCalls++;
        window.__geoOptions = options;
        if (mode === "native") return native(success, failure, options);
        if (mode === "throw") throw new Error("Device service unavailable");
        if (mode === "denied" || mode === "unavailable" || mode === "timeout")
          return failure({
            code: mode === "denied" ? 1 : mode === "unavailable" ? 2 : 3,
          });
        window.__lateGeo = () =>
          success({
            coords: { latitude: 41.9, longitude: 69.9, accuracy: 20 },
          });
      },
    });
  }, mode);
  await page.goto(base + "/checkout/preview");
  await page
    .getByRole("button", { name: "Savatga qo'shish", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .locator(".leaflet-tile-loaded")
    .first()
    .waitFor({ timeout: 20000 });
  assert.equal(
    await page.evaluate(() => window.__geoCalls),
    0,
    "No unsolicited GPS request",
  );
  return { context, page };
}
async function persist(page) {
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Ko'cha yoki mahalla", { exact: true })
    .fill("Amir Temur ko'chasi");
  await dialog.getByLabel("Uy / bino", { exact: true }).fill("12A");
  await dialog
    .getByRole("button", { name: "Manzilni tasdiqlash", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  return page.evaluate(
    () =>
      JSON.parse(
        sessionStorage.getItem("mazetto.preview.fulfillment.checkout-preview"),
      ).selection.location,
  );
}
async function geometry(page) {
  const result = await page.evaluate(() => {
    const dialog = document.querySelector("dialog");
    const button = document.querySelector(".mf-address-change");
    const rect = (dialog ?? button).getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      left: rect.left,
      right: rect.right,
      height: rect.height,
      width: window.innerWidth,
      button: button
        ? {
            height: button.getBoundingClientRect().height,
            color: getComputedStyle(button).color,
            background: getComputedStyle(button).backgroundColor,
          }
        : null,
    };
  });
  assert(
    !result.overflow && result.left >= 0 && result.right <= result.width + 1,
  );
  if (result.button) {
    assert(result.button.height >= 44);
    assert.equal(result.button.background, "rgb(0, 79, 85)");
    assert.equal(result.button.color, "rgb(255, 255, 255)");
  }
}
try {
  for (const width of [320, 390, 768, 1440]) {
    const { context, page } = await setup(width);
    await geometry(page);
    await page.screenshot({ path: output + "/dialog-" + width + ".png" });
    await page
      .getByRole("button", { name: "Joylashuvimni aniqlash", exact: true })
      .click();
    await page.getByText("Nuqta belgilandi", { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__geoOptions), {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    });
    const point = await persist(page);
    assert.equal(point.latitude, 41.3159);
    assert.equal(point.longitude, 69.2812);
    assert.equal(point.source, "gps");
    await geometry(page);
    await page.screenshot({ path: output + "/checkout-" + width + ".png" });
    await page
      .getByRole("button", { name: "O'zgartirish", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await context.close();
  }
  checks.push(
    "Native browser geolocation with supplied test coordinates persists exact GPS point; visible edit button works at 320/390/768/1440",
  );
  for (const mode of ["denied", "unavailable", "timeout", "throw", "pending"]) {
    const { context, page } = await setup(390, mode);
    await page
      .getByRole("button", { name: "Joylashuvimni aniqlash", exact: true })
      .click();
    await page
      .locator('.mf-location-notice[role="alert"]')
      .waitFor({ timeout: 15000 });
    assert.equal(
      await page
        .getByRole("button", { name: "Joylashuvimni aniqlash", exact: true })
        .isEnabled(),
      true,
    );
    await page.locator(".mf-map-canvas").click({ position: { x: 75, y: 115 } });
    await page.getByText("Nuqta belgilandi", { exact: true }).waitFor();
    assert.equal(
      await page.locator('.mf-location-notice[role="alert"]').count(),
      0,
    );
    if (mode === "pending") await page.evaluate(() => window.__lateGeo());
    const point = await persist(page);
    assert.equal(point.source, "map");
    assert.notEqual(point.latitude, 41.9);
    await context.close();
  }
  checks.push(
    "Denied/unavailable/native timeout/thrown/pending GPS unlock controls, preserve map fallback and ignore stale callbacks",
  );
  const low = await setup(390, "native", 350);
  await low.page
    .getByRole("button", { name: "Joylashuvimni aniqlash", exact: true })
    .click();
  await low.page
    .getByText("GPS aniqligi past. Bino joyini xaritada tekshiring.", {
      exact: true,
    })
    .waitFor();
  await low.context.close();
  checks.push("Low-accuracy GPS displays an explicit warning");
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  globalThis.console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
}
