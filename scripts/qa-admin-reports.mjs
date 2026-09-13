import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const report = {
  period: {
    from: "2026-09-13T19:00:00.000Z",
    to: "2026-09-14T18:59:59.999Z",
    timezone: "Asia/Tashkent",
    preset: "today",
  },
  branchId: null,
  source: null,
  salesRule: {
    basis: "Muvaffaqiyatli to'lovlar.",
    paymentStatuses: ["PAID", "SUCCESS"],
    orderStatuses: ["COMPLETED"],
    excludedOrderStatuses: ["CANCELLED"],
  },
  revenue: "325000",
  totalSales: "325000",
  orderCount: 3,
  averageOrderValue: "108333.33",
  cashSales: "200000",
  cancelledOrders: 1,
  refundHandling: {
    supported: false,
    amount: null,
    note: "Refund reconciliation hali ulanmagan.",
  },
  paymentBreakdown: [
    {
      paymentMethod: { id: "cash", code: "CASH", name: "Naqd" },
      amount: "200000",
      count: 2,
    },
    {
      paymentMethod: { id: "card", code: "CARD", name: "Terminal" },
      amount: "125000",
      count: 1,
    },
  ],
  sourceBreakdown: [
    { source: "WEB", amount: "125000", orderCount: 1, paymentCount: 1 },
    { source: "TELEGRAM", amount: "0", orderCount: 0, paymentCount: 0 },
    { source: "POS", amount: "200000", orderCount: 2, paymentCount: 2 },
  ],
  branchBreakdown: [
    {
      branch: { id: "qa-branch", code: "SRG", name: "MAZETTO Sergeli" },
      amount: "325000",
      orderCount: 3,
    },
  ],
  cashierBreakdown: [],
  shiftBreakdown: [],
  topProducts: [
    {
      productId: "p1",
      productName: "Tandir lavash",
      quantity: "3",
      amount: "180000",
    },
  ],
  categorySales: [
    {
      category: { id: "c1", code: "LAVASH", name: "Lavashlar" },
      quantity: "3",
      amount: "180000",
    },
  ],
  timeSeries: {
    grain: "day",
    data: [{ date: "2026-09-14", amount: "325000", orderCount: 3 }],
  },
  limitations: {
    categorySales: "Joriy kategoriya bog'lanishi.",
    onlinePayments: "Provider reconciliation ulanmagan.",
  },
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
      acceptDownloads: true,
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "mazetto.auth.session",
        JSON.stringify({
          user: {
            id: "qa-admin",
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
      if (url.pathname.endsWith("/branches")) {
        return fulfill(route, [{ id: "qa-branch", name: "MAZETTO Sergeli" }]);
      }
      if (url.pathname.endsWith("/reports/sales")) {
        return fulfill(route, report);
      }
      return fulfill(route, []);
    });

    await page.goto(`${baseUrl}/admin/reports`, {
      waitUntil: "domcontentloaded",
    });
    try {
      await page.getByText("325,000 so'm").first().waitFor({ timeout: 15_000 });
    } catch (error) {
      console.error(
        `admin reports ${viewport.width} body:\n${await page.locator("body").innerText()}`,
      );
      throw error;
    }
    assert.ok(await page.getByRole("button", { name: "CSV" }).isVisible());
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV" }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^savdo-.*\.csv$/);

    console.log(`admin reports ${viewport.width}: ok`);
    await page.close();
  }
} finally {
  await browser.close();
}
