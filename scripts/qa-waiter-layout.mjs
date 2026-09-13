import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const outputDir = path.join(os.tmpdir(), "mazetto-role-layout");
const templateTables = Array.from({ length: 12 }, (_, index) => ({
  id: `qa-table-${index + 1}`,
  branchId: "qa-branch",
  name: `${index + 1}-stol`,
  number: index + 1,
  capacity: index % 2 ? 2 : 4,
  status: index === 5 ? "RESERVED" : "AVAILABLE",
  hall: { id: index < 6 ? "main" : "terrace", name: index < 6 ? "Asosiy zal" : "Terrasa" },
  orders: [],
}));
const products = [
  { id: "lavash", categoryId: "food", name: "Tandir lavash", sellingPrice: "42000", variants: [], modifiers: [] },
  { id: "cola", categoryId: "drink", name: "Coca-Cola", sellingPrice: "14000", variants: [], modifiers: [] },
];

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
    const tables = structuredClone(templateTables);
    let openedOrder = null;
    await page.addInitScript(() => {
      window.localStorage.setItem("mazetto.auth.session", JSON.stringify({
        user: { id: "qa-admin", email: "qa@local.preview", roles: ["SUPER_ADMIN"], permissions: ["*"], branchId: "qa-branch" },
        tokens: { accessToken: "qa", refreshToken: "qa", tokenType: "Bearer" },
      }));
    });
    const fulfill = (route, data) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data }),
    });
    await page.route("**/api/v1/tables**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/tables")) return fulfill(route, tables);
      if (url.pathname.endsWith("/tables/qa-table-1/orders") && route.request().method() === "POST") {
        const payload = route.request().postDataJSON();
        const sequence = tables[0].orders.length + 1;
        openedOrder = {
          id: sequence === 1 ? "qa-order" : `qa-order-${sequence}`,
          orderNumber: String(300 + sequence),
          status: "NEW",
          isSupplemental: payload.isSupplemental ?? false,
          total: "0",
          guestCount: payload.guestCount,
          createdAt: `2026-09-13T08:${20 + sequence * 10}:00.000Z`,
          items: [],
        };
        tables[0].orders.unshift(openedOrder);
        tables[0].status = "OCCUPIED";
        return fulfill(route, { id: openedOrder.id });
      }
      if (url.pathname.endsWith("/tables/qa-table-1")) return fulfill(route, tables[0]);
      return fulfill(route, tables.find((table) => url.pathname.endsWith(`/tables/${table.id}`)));
    });
    await page.route("**/api/v1/menu/categories**", (route) =>
      fulfill(route, [{ id: "food", name: "Taomlar" }, { id: "drink", name: "Ichimliklar" }]),
    );
    await page.route("**/api/v1/menu/products**", (route) => fulfill(route, products));
    await page.route("**/api/v1/orders/*/items", (route) => {
      const payload = route.request().postDataJSON();
      const orderId = new URL(route.request().url()).pathname.split("/").at(-2);
      const targetOrder = tables[0].orders.find((entry) => entry.id === orderId);
      assert.ok(targetOrder);
      const product = products.find((entry) => entry.id === payload.productId);
      assert.ok(product);
      targetOrder.items.push({
        id: `qa-item-${orderId}-${targetOrder.items.length}`,
        productId: product.id,
        variantId: null,
        productName: product.name,
        quantity: String(payload.quantity),
        unitPrice: product.sellingPrice,
        totalPrice: String(Number(product.sellingPrice) * payload.quantity),
        status: "ACTIVE",
      });
      targetOrder.total = String(targetOrder.items.reduce((sum, item) => sum + Number(item.totalPrice), 0));
      return fulfill(route, { id: targetOrder.items.at(-1).id });
    });
    await page.route("**/api/v1/orders/*/status", (route) => {
      const orderId = new URL(route.request().url()).pathname.split("/").at(-2);
      const targetOrder = tables[0].orders.find((entry) => entry.id === orderId);
      assert.ok(targetOrder);
      targetOrder.status = route.request().postDataJSON().status;
      return fulfill(route, targetOrder);
    });
    await page.goto(`${baseUrl}/waiter`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^1-stol / }).waitFor();
    const floorMetrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      columns: getComputedStyle(document.querySelector('[class*="tableGrid"]')).gridTemplateColumns.split(/\s+/).length,
    }));
    assert.ok(floorMetrics.scrollWidth <= viewport.width + 1, JSON.stringify(floorMetrics));
    if (viewport.width < 768) assert.equal(floorMetrics.columns, 2);
    await page.screenshot({ path: path.join(outputDir, `waiter-floor-${viewport.width}.png`), fullPage: false });
    await page.getByRole("button", { name: /^1-stol / }).click();
    await page.getByRole("button", { name: "Stolni ochish" }).waitFor();
    await page.screenshot({ path: path.join(outputDir, `waiter-selected-${viewport.width}.png`), fullPage: false });
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      tableColumns: getComputedStyle(document.querySelector('[class*="tableGrid"]')).gridTemplateColumns,
      orderPanelTop: document.querySelector('aside[aria-label="Joriy buyurtma"]')?.getBoundingClientRect().top,
    }));
    assert.ok(metrics.scrollWidth <= metrics.viewport + 1, JSON.stringify(metrics));
    await page.getByRole("button", { name: "Stolni ochish" }).click();
    await page.getByRole("button", { name: /Tandir lavash,.*buyurtmaga qo'shish/ }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(outputDir, `waiter-menu-${viewport.width}.png`), fullPage: false });
    await page.getByRole("button", { name: /Tandir lavash,.*buyurtmaga qo'shish/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Qo'shish" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    if (viewport.width < 1024) {
      if (viewport.width < 768) {
        await page.locator('div[class*="mobilePaybar"] button').click();
      } else {
        await page.getByRole("group", { name: "Ko'rinish" })
          .getByRole("button", { name: "Buyurtma" }).click();
      }
      await page.getByRole("button", { name: "Stollarga qaytish" }).waitFor();
    }
    await page.getByRole("button", { name: "Oshxonaga yuborish" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Tasdiqlash va yuborish" }).click();
    await page.getByRole("button", { name: "Qo'shimcha buyurtma" }).waitFor();
    await page.getByRole("button", { name: "Qo'shimcha buyurtma" }).click();
    await page.getByRole("button", { name: /Coca-Cola,.*buyurtmaga qo'shish/ }).waitFor();
    assert.equal(tables[0].orders.length, 2);
    assert.equal(tables[0].orders[0].isSupplemental, true);
    if (viewport.width < 1024) {
      await page.screenshot({ path: path.join(outputDir, `waiter-supplemental-${viewport.width}.png`), fullPage: false });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (viewport.width < 768) {
        await page.locator('div[class*="mobilePaybar"] button').click();
      } else {
        await page.getByRole("group", { name: "Ko'rinish" })
          .getByRole("button", { name: "Buyurtma" }).click();
      }
      await page.getByRole("button", { name: /Qo'shimcha #302/ }).waitFor();
      await page.screenshot({ path: path.join(outputDir, `waiter-order-${viewport.width}.png`), fullPage: false });
      await page.getByRole("button", { name: "Stollarga qaytish" }).click();
      assert.ok(await page.getByRole("button", { name: /^2-stol / }).isVisible());
      await page.getByRole("button", { name: /^12-stol / }).click();
      const deepSelection = await page.evaluate(() => ({
        scrollY,
        orderPanelTop: document.querySelector('aside[aria-label="Joriy buyurtma"]')?.getBoundingClientRect().top,
      }));
      assert.ok(deepSelection.orderPanelTop < viewport.height, JSON.stringify(deepSelection));
      assert.ok(deepSelection.scrollY < 10, JSON.stringify(deepSelection));
    }
    console.log(`waiter ${viewport.width}: ${JSON.stringify(metrics)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
