import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const outputDir = path.join(os.tmpdir(), "mazetto-role-layout");
const names = [
  "Tandir lavash",
  "Kurinniy Big Lavash",
  "Mol go'shtli burger",
  "Fri kartoshka",
  "Coca-Cola",
  "Pepsi",
  "Lavashlar uchligi",
  "Katlet podamashni juftligi",
  "Achchiq sous",
  "Limonad",
];
const catalog = {
  branchId: "qa-branch",
  categories: [
    { id: "food", name: "Taomlar" },
    { id: "drink", name: "Ichimliklar" },
  ],
  products: names.map((name, index) => ({
    id: `qa-product-${index}`,
    categoryId: index === 4 || index === 5 || index === 9 ? "drink" : "food",
    name,
    sellingPrice: String((index + 2) * 12000),
    isCombo: false,
    variants: [],
    modifiers: [],
  })),
  paymentMethods: [{ code: "CASH", name: "Naqd", active: true }],
  tables: [],
};

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 768, height: 900 },
    { width: 360, height: 780 },
    { width: 320, height: 700 },
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "mazetto.auth.session",
        JSON.stringify({
          user: {
            id: "qa-admin",
            email: "qa@local.preview",
            roles: ["SUPER_ADMIN"],
            permissions: ["*"],
          },
          tokens: {
            accessToken: "qa",
            refreshToken: "qa",
            tokenType: "Bearer",
          },
        }),
      );
    });
    await page.route("**/api/v1/cash-register/shift", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { id: "qa-shift", status: "OPEN", shiftNumber: 1 },
        }),
      }),
    );
    await page.route("**/api/v1/pos/catalog", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: catalog }),
      }),
    );
    await page.goto(`${baseUrl}/pos`, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: /Tandir lavash.*qo'shish/ })
      .waitFor();
    await page.getByRole("button", { name: /Tandir lavash.*qo'shish/ }).click();
    if (viewport.width < 768) {
      await page.screenshot({
        path: path.join(outputDir, `pos-menu-${viewport.width}.png`),
        fullPage: false,
      });
      await page
        .getByRole("button", { name: /Limonad.*qo'shish/ })
        .scrollIntoViewIfNeeded();
      assert.equal(
        await page
          .getByRole("button", { name: /Limonad.*qo'shish/ })
          .isVisible(),
        true,
      );
      const headerTop = await page
        .locator("header")
        .evaluate((header) => header.getBoundingClientRect().top);
      assert.ok(
        Math.abs(headerTop) <= 1,
        "Mobile topbar does not stay in view",
      );
      await page.getByRole("button", { name: /Buyurtma 1/ }).click();
      await page
        .getByRole("complementary", { name: "Joriy buyurtma" })
        .waitFor();
    }
    const metrics = await page.evaluate(() => {
      const shell = document.querySelector("main");
      const receipt = document.querySelector(
        'aside[aria-label="Joriy buyurtma"]',
      );
      const bottom = document.querySelector('[class*="mobilePaybar"]');
      return {
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        shellRight: shell?.getBoundingClientRect().right,
        receiptRight: receipt?.getBoundingClientRect().right,
        bottomRight: bottom?.getBoundingClientRect().right,
        bottomVisible: bottom && getComputedStyle(bottom).display !== "none",
      };
    });
    assert.ok(metrics.scrollWidth <= viewport.width + 1, "Horizontal overflow");
    assert.ok(
      Math.abs(metrics.shellRight - viewport.width) <= 2,
      "Shell width",
    );
    assert.ok(metrics.receiptRight <= viewport.width + 1, "Receipt overflow");
    assert.equal(metrics.bottomVisible, viewport.width < 768);
    if (viewport.width === 1600) {
      await page.getByRole("button", { name: "Menyuni yig'ish" }).click();
      assert.equal(
        await page
          .getByRole("complementary", { name: "Ish joylari menyusi" })
          .isVisible(),
        false,
      );
      await page.getByRole("button", { name: "Menyuni kengaytirish" }).click();
      assert.equal(
        await page
          .getByRole("complementary", { name: "Ish joylari menyusi" })
          .isVisible(),
        true,
      );
    }
    if (viewport.width === 320) {
      await page.getByRole("button", { name: "Menyuni ochish" }).click();
      await page.locator("#staff-panel-menu").waitFor();
      await page
        .locator("#staff-panel-menu")
        .getByRole("button", { name: "Menyuni yopish" })
        .click();
    }
    await page.screenshot({
      path: path.join(outputDir, `pos-cart-${viewport.width}.png`),
      fullPage: false,
    });
    if (viewport.width < 768) {
      await page.getByRole("button", { name: "To'lov" }).click();
      await page.getByRole("dialog", { name: "To'lov va buyurtma" }).waitFor();
      await page.screenshot({
        path: path.join(outputDir, `pos-checkout-${viewport.width}.png`),
        fullPage: false,
      });
    }
    process.stdout.write(`${viewport.width} ${JSON.stringify(metrics)}\n`);
    await page.close();
  }

  const errorPage = await browser.newPage({
    viewport: { width: 360, height: 780 },
  });
  await errorPage.addInitScript(() => {
    window.localStorage.setItem(
      "mazetto.auth.session",
      JSON.stringify({
        user: { id: "qa-admin", roles: ["SUPER_ADMIN"], permissions: ["*"] },
        tokens: { accessToken: "qa", refreshToken: "qa", tokenType: "Bearer" },
      }),
    );
  });
  await errorPage.route("**/api/v1/cash-register/shift", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { id: "qa-shift", status: "OPEN" },
      }),
    }),
  );
  await errorPage.route("**/api/v1/pos/catalog", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: { message: "Katalog yuklanmadi" },
      }),
    }),
  );
  await errorPage.goto(`${baseUrl}/pos`, { waitUntil: "domcontentloaded" });
  await errorPage.getByRole("button", { name: "Qayta urinish" }).waitFor();
  assert.equal(
    await errorPage.getByRole("button", { name: /Buyurtma 0/ }).count(),
    0,
  );
  await errorPage.screenshot({
    path: path.join(outputDir, "pos-error-360.png"),
    fullPage: false,
  });
  await errorPage.close();
} finally {
  await browser.close();
}
