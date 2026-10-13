import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://127.0.0.1:3103";
const roles = [
  {
    role: "SUPER_ADMIN",
    expected: "/admin/dashboard",
    permissions: ["*"],
    adminAllowed: true,
  },
  {
    role: "ADMIN",
    expected: "/admin/dashboard",
    permissions: ["ADMIN_ACCESS", "DASHBOARD_VIEW"],
    adminAllowed: true,
  },
  {
    role: "BRANCH_MANAGER",
    expected: "/manager/dashboard",
    permissions: ["ADMIN_ACCESS", "DASHBOARD_VIEW", "ORDER_VIEW"],
    adminAllowed: true,
  },
  {
    role: "ACCOUNTANT",
    expected: "/accounting",
    permissions: ["DASHBOARD_VIEW", "PAYMENT_VIEW", "REPORT_SALES_VIEW"],
    adminAllowed: false,
  },
  {
    role: "CASHIER",
    expected: "/shift",
    permissions: ["SHIFT_VIEW_OWN", "POS_USE", "PAYMENT_CREATE"],
    adminAllowed: false,
  },
  {
    role: "WAITER",
    expected: "/waiter",
    permissions: ["TABLE_VIEW", "ORDER_CREATE", "ORDER_UPDATE"],
    adminAllowed: false,
  },
  {
    role: "KITCHEN",
    expected: "/kitchen",
    permissions: ["KITCHEN_VIEW", "KITCHEN_ACCEPT", "KITCHEN_STATUS_UPDATE"],
    adminAllowed: false,
  },
  {
    role: "COURIER",
    expected: "/courier",
    permissions: ["COURIER_DELIVERY_VIEW", "COURIER_DELIVERY_UPDATE"],
    adminAllowed: false,
  },
];
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const role of roles) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(
        ({ role: roleCode, permissions }) => {
          localStorage.setItem(
            "mazetto.auth.session",
            JSON.stringify({
              user: {
                id: `qa-${roleCode.toLowerCase()}`,
                email: `${roleCode.toLowerCase()}@qa.local`,
                employeeId: `employee-${roleCode.toLowerCase()}`,
                branchId: "qa-branch",
                roles: [roleCode],
                permissions,
              },
              tokens: { accessToken: "qa-access", tokenType: "Bearer" },
            }),
          );
        },
        role,
      );
      await context.route("**/api/v1/**", async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        let data = [];
        if (pathname.endsWith("/kitchen/orders")) {
          data = { items: [], hasMore: false, limit: 250 };
        } else if (pathname.endsWith("/dashboard/summary")) {
          data = {
            todayRevenue: 0,
            todayOrdersCount: 0,
            activeShifts: 0,
            averageOrderValue: 0,
            branchId: "qa-branch",
          };
        } else if (pathname.endsWith("/reports/sales")) {
          data = {
            period: { from: "2026-10-13", to: "2026-10-13" },
            revenue: 0,
            orderCount: 0,
            averageOrderValue: 0,
            cashSales: 0,
            cancelledOrders: 0,
            paymentBreakdown: [],
            branchBreakdown: [],
            shiftBreakdown: [],
            topProducts: [],
            timeSeries: { grain: "day", data: [] },
          };
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data }),
        });
      });
      const pageErrors = [];
      const page = await context.newPage();
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(`**${role.expected}`, { timeout: 15_000 });
      assert.equal(new URL(page.url()).pathname, role.expected);
      assert.ok(
        (await page.evaluate(() => document.documentElement.scrollWidth)) <=
          viewport.width + 1,
        `${role.role} ${viewport.width}px horizontal overflow`,
      );

      if (!role.adminAllowed) {
        await page.goto(`${baseUrl}/admin/dashboard`, {
          waitUntil: "domcontentloaded",
        });
        await page
          .getByRole("heading", {
            name: "Bu bo'lim sizning rolingiz uchun ochilmagan",
          })
          .waitFor({ timeout: 15_000 });
        assert.equal(new URL(page.url()).pathname, "/admin/dashboard");
      }
      console.log(`${role.role} ${viewport.width}px: ${role.expected} ok`);
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
      assert.deepEqual(pageErrors, [], `${role.role} ${viewport.width}px page errors: ${pageErrors.join("; ")}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
