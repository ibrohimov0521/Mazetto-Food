import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const log = {
  id: "audit-1",
  action: "CASH_HANDOVER_FORCED",
  entity: "Shift",
  entityId: "shift-1",
  metadata: {
    branchId: "branch-1",
    amount: "250000",
    transferId: "transfer-1",
  },
  createdAt: "2026-09-13T22:00:00.000Z",
  user: { id: "admin-1", displayName: "Bosh admin" },
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 768, height: 900 },
    { width: 360, height: 780 },
    { width: 320, height: 700 },
  ]) {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 1,
      timezoneId: "Asia/Tashkent",
    });
    const listQueries = [];
    await page.addInitScript(() => {
      localStorage.setItem(
        "mazetto.auth.session",
        JSON.stringify({
          user: {
            id: "admin-1",
            roles: ["SUPER_ADMIN"],
            permissions: ["*"],
            isGlobalScope: true,
          },
          tokens: {
            accessToken: "qa",
            refreshToken: "qa",
            tokenType: "Bearer",
          },
        }),
      );
    });
    const fulfill = (route, data) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data }),
      });
    await page.route("**/api/v1/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/audit-logs/facets")) {
        return fulfill(route, {
          actions: ["CASH_HANDOVER_FORCED"],
          entities: ["Shift"],
        });
      }
      if (url.pathname.endsWith("/audit-logs")) {
        listQueries.push(url.searchParams);
        return fulfill(route, [log]);
      }
      return fulfill(route, []);
    });

    await page.goto(`${baseUrl}/admin/audit`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByText("Naqd pul majburiy topshirildi")
      .and(page.locator(":visible"))
      .first()
      .waitFor();
    await page.getByRole("button", { name: "Tafsilot" }).click();
    await page.getByText('"transferId": "transfer-1"').waitFor();

    await page.getByLabel("Sanadan").fill("2026-09-14");
    await page.waitForFunction(
      () =>
        document.querySelector('input[type="date"]')?.value === "2026-09-14",
    );
    await page.waitForTimeout(200);
    const lastQuery = listQueries.at(-1);
    assert.equal(lastQuery?.get("from"), "2026-09-13T19:00:00.000Z");

    await page.getByLabel("Sanagacha").fill("2026-09-13");
    await page.getByText("Boshlanish sanasi tugash sanasidan keyin.").waitFor();
    await page.waitForTimeout(200);
    assert.equal(
      listQueries.at(-1),
      lastQuery,
      "teskari oraliq APIga ketmasin",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `${viewport.width}px da gorizontal overflow bor`,
    );
    console.log(`admin audit ${viewport.width}: ok`);
    await page.close();
  }
} finally {
  await browser.close();
}
