/* global window, document, console, process */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { shiftReportHtml } from "../apps/pos-web/lib/shift-close-report.mjs";

const base = process.env.POS_WEB_URL ?? "http://127.0.0.1:3117";
const output = "/tmp/mazetto-shift-report-qa";
await mkdir(output, { recursive: true });
const shift = {
  id: "qa-shift", shiftNumber: 47, status: "OPEN",
  openedAt: "2026-10-09T06:00:00Z", expectedCash: "240000", openingBalance: "10000",
  salesTotal: "230000", branch: { id: "branch", name: "Test filial" },
  employee: { firstName: "Sinov", lastName: "Kassir" },
};
const orders = Array.from({ length: 205 }, (_, i) => ({
  id: "qa-order-" + i, orderNumber: "Q" + (i + 1),
  status: ["SERVED", "COMPLETED", "CANCELLED", "PREPARING"][i % 4],
  total: "17000", createdAt: shift.openedAt,
  items: [{ id: "item-" + i, productName: "Lavash pishloqli, sous alohida", quantity: "1", status: "ACTIVE" }],
}));
const closed = { ...shift, status: "CLOSED", closedAt: "2026-10-09T19:00:00Z", closingBalance: "240000", cashDifference: "0" };
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [302, 794]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent(shiftReportHtml(closed, orders));
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("tbody tr").count(), 205);
    assert.equal(await page.locator("footer").isVisible(), true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.equal(await page.locator("body").evaluate((el) => window.getComputedStyle(el).color), "rgb(0, 0, 0)");
    await page.pdf({ path: output + "/report-" + width + ".pdf", width: width === 302 ? "80mm" : "210mm", height: "297mm", printBackground: true });
    await page.screenshot({ path: output + "/report-" + width + ".png" });
    await page.close();
  }
  for (const width of [375, 768, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const user = { id: "qa", employeeId: "emp", branchId: "branch", roles: ["CASHIER"], permissions: ["*"], email: "qa@example.test" };
    await page.addInitScript((user) => {
      window.localStorage.setItem("mazetto.auth.session", JSON.stringify({
        user, tokens: { accessToken: "qa", refreshToken: "qa", tokenType: "Bearer" },
      }));
      window.__printCount = 0;
      window.__printedHtml = "";
      // Captures the isolated frame's print call without touching a physical printer.
      const original = Element.prototype.append;
      Element.prototype.append = function (...nodes) {
        for (const node of nodes) {
          if (node instanceof HTMLIFrameElement && node.title === "Smena chop etish hisoboti") {
            const loaded = node.onload;
            node.onload = function (event) {
              node.contentWindow.print = () => {
                window.__printCount += 1;
                window.__printedHtml = node.contentDocument.documentElement.outerHTML;
              };
              return loaded.call(this, event);
            };
          }
        }
        return original.apply(this, nodes);
      };
    }, user);
    let closedNow = false;
    let closeCalls = 0;
    let reportReads = 0;
    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace("/api/v1", "");
      let data = [];
      if (path === "/auth/me") data = user;
      else if (path === "/cash-register/shift") data = closedNow ? null : shift;
      else if (path === "/cash-register/shift/qa-shift/close") { closeCalls++; closedNow = true; data = closed; }
      else if (path === "/cash-register/shift/qa-shift/orders") {
        if (closedNow) reportReads++;
        if (closedNow && width === 375) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "Offline" } }) });
          return;
        }
        const offset = Number(url.searchParams.get("offset") ?? 0);
        data = orders.slice(offset, offset + 100);
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    });
    await page.goto(base + "/shift", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Haqiqiy naqd summa").fill("240000");
    await page.getByRole("button", { name: "Smenani yopish", exact: true }).click();
    await page.getByRole("button", { name: "Yakunlash", exact: true }).click();
    await page.waitForFunction(() => window.__printCount === 1);
    assert.equal(closeCalls, 1);
    assert.equal(reportReads, width === 375 ? 1 : 3, "fetch all available pages after close");
    assert.equal((await page.evaluate(() => window.__printedHtml)).match(/data-order-id=/g).length, 205);
    if (width === 375) assert.match(await page.evaluate(() => window.__printedHtml), /Oflayn nusxa/);
    await page.getByRole("button", { name: "Smena hisobotini chop etish" }).click();
    await page.waitForFunction(() => window.__printCount === 2);
    assert.equal(closeCalls, 1, "reprinting must not close or charge again");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.deepEqual(errors, []);
    await page.screenshot({ path: output + "/closed-" + width + ".png", fullPage: false });
    await page.close();
  }
  await writeFile(output + "/result.json", JSON.stringify({ orders: 205, printWidths: [302, 794], uiWidths: [375, 768, 1366], passed: true }, null, 2));
  console.log("PASS: 205 orders; narrow/A4 print; offline fallback and automatic report dialog at 375/768/1366px");
} finally {
  await browser.close();
}
