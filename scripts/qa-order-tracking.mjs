import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");
const base = process.argv[2] || "http://127.0.0.1:3104";
const out = "/tmp/mazetto-tracking-qa";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    const session = { id: "qa", name: "Sinov", phone: "+998900000000", accessToken: "qa-intercepted", refreshToken: "qa-intercepted", tokenType: "Bearer", bonusBalance: "0" };
    await context.addInitScript(session => {
      localStorage.setItem("mazetto.customer.session", JSON.stringify(session));
      localStorage.setItem("mazetto.customer.splash.seen", "1");
    }, session);
    let status = "PREPARING";
    let type = "DELIVERY";
    let requests = 0;
    const order = () => ({ id: "qa-order", status: status === "SERVED" ? "READY" : status, type, createdAt: new Date().toISOString(), branch: { name: "MAZETTO Sergeli" }, order: { orderNumber: "QA1", displayOrderNumber: "WEB103", status, total: "72000", items: [{ id: "item", productName: "Katta lavash", quantity: "2", unitPrice: "36000", totalPrice: "72000" }], payments: [] } });
    await context.route("**/api/v1/**", async route => {
      const path = new URL(route.request().url()).pathname;
      let data = [];
      if (path.endsWith("/orders/qa-order")) { data = order(); requests++; }
      else if (path.endsWith("/orders")) { data = [order()]; requests++; }
      else if (path.endsWith("/dashboard")) data = { ...session, customer: session, favorites: [], customerOrders: [] };
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto(base + "/orders/qa-order");
    const progress = page.locator("[data-order-status]");
    await progress.waitFor();
    const labels = { NEW: "Yangi buyurtma", CONFIRMED: "Qabul qilindi", PREPARING: "Tayyorlanmoqda", READY: "Tayyor", SERVED: "Kuryer yo'lda", COMPLETED: "Yetkazildi", CANCELLED: "Bekor qilindi", FUTURE: "Holat tekshirilmoqda" };
    for (const [next, label] of Object.entries(labels)) {
      status = next;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.waitForFunction(next => document.querySelector("[data-order-status]")?.getAttribute("data-order-status") === next, next);
      assert.ok((await progress.getByRole("status").innerText()).includes(label));
      assert.equal(await progress.locator("li[aria-current=step]").count(), ["CANCELLED", "FUTURE"].includes(next) ? 0 : 1);
      assert.equal(await progress.locator("ol").count(), ["CANCELLED", "FUTURE"].includes(next) ? 0 : 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(await progress.locator("li").evaluateAll(nodes => nodes.flatMap(li => {
        const range = document.createRange();
        range.selectNodeContents(li.lastElementChild);
        const text = range.getBoundingClientRect(), box = li.getBoundingClientRect();
        return text.left < box.left - 1 || text.right > box.right + 1 ? [li.textContent] : [];
      })), [], "Stage labels must stay within their columns");
      if (next === "SERVED") {
        assert.equal(await progress.getByRole("status").locator(".lucide-bike").count(), 1);
        await page.screenshot({ path: `${out}/delivery-${width}.png`, fullPage: true });
      }
    }
    type = "PICKUP"; status = "SERVED";
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes("Topshirildi"));
    assert.equal(await progress.getByRole("status").locator(".lucide-shopping-bag").count(), 1);
    type = "DELIVERY";
    await page.goto(base + "/orders");
    await page.waitForSelector('[data-order-status="SERVED"]');
    assert.ok((await page.locator("[data-order-status]").innerText()).includes("Kuryer yo'lda"));
    if (width === 390) {
      status = "READY";
      const before = requests;
      await page.waitForSelector('[data-order-status="READY"]', { timeout: 20000 });
      assert.ok(requests > before, "Polling must refresh without socket or focus events");
    }
    assert.deepEqual(errors, []);
    results.push({ width, passed: "8 statuses, raw status precedence, pickup icon, focus refresh, no overflow" });
    await context.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
