import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const outputDir = path.join(os.tmpdir(), "mazetto-role-layout");
const now = new Date().toISOString();
const statuses = ["NEW", "ACCEPTED", "COOKING", "READY"];
const tickets = Array.from({ length: 12 }, (_, index) => ({
  id: `qa-ticket-${index}`,
  ticketNumber: String(index + 301),
  status: statuses[Math.floor(index / 3)],
  priority: 0,
  version: 1,
  createdAt: now,
  items: [
    { id: `qa-item-${index}-1`, productName: "Tandir lavash", quantity: "2" },
    { id: `qa-item-${index}-2`, productName: "Coca-Cola", quantity: "1" },
  ],
  order: {
    id: `qa-order-${index}`,
    orderNumber: String(index + 301),
    displayOrderNumber: String(index + 301),
    source: index % 2 ? "TELEGRAM" : "POS",
    type: index % 3 ? "DINE_IN" : "DELIVERY",
    table: index % 3 ? { name: `${index + 1}-stol` } : null,
    branch: { name: "Sergeli" },
    kitchenComment: index % 3 ? null : "Qo'ng'iroq qilmaslik kerak",
    items: [
      { id: `qa-item-${index}-1`, productName: "Tandir lavash", quantity: "2" },
      { id: `qa-item-${index}-2`, productName: "Coca-Cola", quantity: "1" },
    ],
  },
}));

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 1280, height: 800 },
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
    await page.route("**/api/v1/kitchen/orders", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: tickets }),
      }),
    );
    await page.goto(`${baseUrl}/kitchen`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /Buyurtmalar navbati/ }).waitFor();
    await page.getByRole("article").first().waitFor();

    const metrics = await page.evaluate(() => {
      const shell = document.querySelector("main");
      const header = document.querySelector("header");
      const firstTicket = document.querySelector(
        'section[aria-label="Yangi"] article',
      );
      const firstAction = firstTicket?.querySelector(
        "button[title='Qabul qilish']",
      );
      const shellRect = shell?.getBoundingClientRect();
      const ticketRect = firstTicket?.getBoundingClientRect();
      const actionRect = firstAction?.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        shellRight: shellRect?.right,
        headerRight: header?.getBoundingClientRect().right,
        ticketWidth: ticketRect?.width,
        actionInside:
          Boolean(ticketRect && actionRect) &&
          actionRect.left >= ticketRect.left &&
          actionRect.right <= ticketRect.right,
        logoVisible:
          getComputedStyle(document.querySelector(".mz-panel-logo")).display !==
          "none",
        brandVisible:
          getComputedStyle(document.querySelector(".mz-panel-brand"))
            .display !== "none",
      };
    });
    const filename = `kitchen-${viewport.width}.png`;
    await page.screenshot({
      path: path.join(outputDir, filename),
      fullPage: false,
    });
    assert.ok(metrics.scrollWidth <= viewport.width + 1, "Horizontal overflow");
    assert.ok(
      Math.abs(metrics.shellRight - viewport.width) <= 2,
      "Shell does not fill viewport",
    );
    assert.ok(
      Math.abs(metrics.headerRight - viewport.width) <= 2,
      "Header does not fill viewport",
    );
    assert.ok(metrics.actionInside, "Order action leaves its card");
    assert.equal(metrics.brandVisible, viewport.width < 768);
    assert.equal(metrics.logoVisible, viewport.width >= 768);

    if (viewport.width >= 1200) {
      const cardPositions = await page
        .locator('section[aria-label="Yangi"] article')
        .evaluateAll((cards) =>
          cards.slice(0, 2).map((card) => card.getBoundingClientRect().left),
        );
      if (viewport.width >= 1500) {
        assert.notEqual(
          cardPositions[0],
          cardPositions[1],
          "Orders are not in two columns",
        );
      } else {
        assert.equal(
          cardPositions[0],
          cardPositions[1],
          "Orders are too narrow",
        );
      }
    }

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

    if (viewport.width < 768) {
      await page.getByRole("button", { name: "Menyuni ochish" }).click();
      await page
        .getByRole("complementary", { name: "Ish joylari menyusi" })
        .waitFor();
      await page
        .locator("#staff-panel-menu")
        .getByRole("button", { name: "Menyuni yopish" })
        .click();
      const card = page.locator('section[aria-label="Yangi"] article').first();
      await card
        .getByRole("button", { name: /buyurtmani qisqartirish/ })
        .click();
      assert.equal(
        await card.locator("li").count(),
        0,
        "Compact card still shows items",
      );
    }

    process.stdout.write(`${filename} ${JSON.stringify(metrics)}\n`);
    await page.close();
  }

  for (const route of [
    { path: "/courier", title: "Kuryer" },
    { path: "/waiter", title: "Ofitsiant" },
    { path: "/shift", title: "Xodim kassasi" },
  ]) {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 360, height: 780 },
    ]) {
      const page = await browser.newPage({ viewport });
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
      await page.route("**/api/v1/**", (request) =>
        request.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: { message: "QA API unavailable" },
          }),
        }),
      );
      await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: "domcontentloaded",
      });
      await page
        .getByRole("heading", { name: route.title, exact: true })
        .first()
        .waitFor();
      const metrics = await page.evaluate(() => {
        const shell = document.querySelector("main");
        return {
          viewport: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          shellRight: shell?.getBoundingClientRect().right,
          headerRight: document.querySelector("header")?.getBoundingClientRect()
            .right,
          brandVisible:
            getComputedStyle(document.querySelector(".mz-panel-brand"))
              .display !== "none",
        };
      });
      assert.ok(
        metrics.scrollWidth <= viewport.width + 1,
        `${route.path} horizontal overflow`,
      );
      assert.ok(
        Math.abs(metrics.shellRight - viewport.width) <= 2,
        `${route.path} shell width`,
      );
      assert.ok(
        Math.abs(metrics.headerRight - viewport.width) <= 2,
        `${route.path} header width`,
      );
      assert.equal(metrics.brandVisible, viewport.width < 768);
      process.stdout.write(
        `${route.path} ${viewport.width} ${JSON.stringify(metrics)}\n`,
      );
      await page.close();
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(`Screenshots: ${outputDir}\n`);
