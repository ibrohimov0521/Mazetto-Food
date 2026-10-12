import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:3118";
const user = {
  id: "qa-cashier",
  employeeId: "qa-employee",
  branchId: "qa-branch",
  email: "qa-cashier@example.test",
  roles: ["CASHIER"],
  permissions: ["SHIFT_VIEW_OWN", "ORDER_UPDATE"],
};
const shift = {
  id: "qa-shift",
  shiftNumber: 12,
  status: "OPEN",
  openedAt: "2026-10-12T08:00:00.000Z",
  openingBalance: "0",
  expectedCash: "0",
  orderCount: 1,
  branch: { id: "qa-branch", name: "Test filial" },
  employee: { firstName: "QA", lastName: "Kassir" },
};
const order = {
  id: "qa-order",
  version: 1,
  shiftId: "qa-shift",
  orderNumber: "101",
  displayOrderNumber: "QA101",
  status: "SERVED",
  paymentStatus: "PENDING",
  total: "10000",
  type: "DINE_IN",
  createdAt: "2026-10-12T08:30:00.000Z",
  items: [
    {
      id: "qa-item-1",
      productName: "Lavash",
      quantity: "1",
      totalPrice: "3000",
      status: "ACTIVE",
    },
    {
      id: "qa-item-2",
      productName: "Ichimlik",
      quantity: "1",
      totalPrice: "7000",
      status: "ACTIVE",
    },
  ],
  payments: [],
  receipts: [],
};
const session = {
  user,
  tokens: {
    accessToken: "qa",
    refreshToken: "qa",
    tokenType: "Bearer",
  },
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  for (const width of [375, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      (value) =>
        localStorage.setItem("mazetto.auth.session", JSON.stringify(value)),
      session,
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace(
        "/api/v1",
        "",
      );
      let data = [];
      if (path === "/auth/me") data = user;
      else if (path === "/cash-register/shifts") data = [shift];
      else if (path.startsWith("/cash-register/shift/qa-shift/orders")) {
        data = [order];
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data }),
      });
    });

    await page.goto(base + "/pos/history", { waitUntil: "domcontentloaded" });
    const orderButton = page.getByRole("button", { name: /QA101/ });
    await orderButton.waitFor();
    await orderButton.click();
    await page
      .getByRole("button", { name: "Lavash mahsulotini bekor qilish" })
      .click();
    const reason = page.getByLabel("Bekor qilish sababi");
    await reason.fill("Oldingi sabab");
    await page.getByRole("button", { name: "Ortga", exact: true }).click();
    await page
      .getByRole("button", { name: "Ichimlik mahsulotini bekor qilish" })
      .click();
    assert.equal(await reason.inputValue(), "", "new cancellation starts blank");
    assert.deepEqual(errors, []);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "history must not overflow horizontally",
    );
    await context.close();
  }
  console.log("PASS: cancellation reason resets between items at 375px and 1280px");
} finally {
  await browser.close();
}
