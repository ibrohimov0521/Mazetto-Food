import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const branch = {
  id: "qa-branch",
  code: "SRG",
  name: "MAZETTO Sergeli",
  address: "Sergeli, Toshkent",
  phone: "+998 90 000 00 00",
  isActive: true,
  isTemporarilyClosed: false,
  acceptsOrders: true,
  deliveryEnabled: true,
  pickupEnabled: true,
  _count: { employees: 8, printers: 2, devices: 4, products: 42 },
};
const hallSummary = {
  id: "qa-hall",
  branchId: branch.id,
  code: "MAIN",
  name: "Asosiy zal",
  description: "Mehmonlar uchun asosiy zal",
  isActive: true,
  sortOrder: 0,
  _count: { tables: 2 },
};
const tables = [
  {
    id: "qa-table-1",
    branchId: branch.id,
    hallId: hallSummary.id,
    number: 1,
    name: "1-stol",
    capacity: 4,
    seats: 4,
    status: "OCCUPIED",
    isActive: true,
    sortOrder: 0,
    orders: [{ id: "qa-order" }],
  },
  {
    id: "qa-table-2",
    branchId: branch.id,
    hallId: hallSummary.id,
    number: 2,
    name: "2-stol",
    capacity: 2,
    seats: 2,
    status: "AVAILABLE",
    isActive: true,
    sortOrder: 1,
    orders: [],
  },
];
const hall = { ...hallSummary, branch, tables };
const table = {
  ...tables[0],
  branch: { id: branch.id, name: branch.name },
  hall: { id: hall.id, name: hall.name },
  orders: [
    {
      id: "qa-order",
      orderNumber: "QA-302",
      displayOrderNumber: "302",
      status: "CONFIRMED",
      isSupplemental: true,
      createdAt: "2026-09-13T10:00:00.000Z",
      waiter: { fullName: "QA Ofitsiant" },
    },
  ],
};

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
      localStorage.setItem(
        "mazetto.auth.session",
        JSON.stringify({
          user: {
            id: "qa-admin",
            email: "qa@local.preview",
            roles: ["SUPER_ADMIN"],
            permissions: ["*"],
            branchId: "qa-branch",
          },
          tokens: { accessToken: "qa", refreshToken: "qa", tokenType: "Bearer" },
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
      if (url.pathname.endsWith("/branches/qa-branch")) return fulfill(route, branch);
      if (url.pathname.endsWith("/halls") && url.searchParams.get("branchId") === branch.id) {
        return fulfill(route, [hallSummary]);
      }
      if (url.pathname.endsWith("/halls/qa-hall")) return fulfill(route, hall);
      if (url.pathname.endsWith("/tables/qa-table-1")) return fulfill(route, table);
      return fulfill(route, []);
    });

    await page.goto(`${baseUrl}/admin/branches/${branch.id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("heading", { name: branch.name }).waitFor();
    assert.ok(await page.getByRole("link", { name: "Zalni ochish" }).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    await Promise.all([
      page.waitForURL(`**/admin/branches/${branch.id}/halls/${hall.id}`),
      page.getByRole("link", { name: "Zalni ochish" }).click(),
    ]);
    await page.getByRole("heading", { name: hall.name, exact: true }).waitFor();
    assert.ok(await page.getByRole("link", { name: "1-stol - ochish" }).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    await Promise.all([
      page.waitForURL(
        `**/admin/branches/${branch.id}/halls/${hall.id}/tables/qa-table-1`,
      ),
      page.getByRole("link", { name: "1-stol - ochish" }).click(),
    ]);
    await page.getByRole("heading", { name: "1-stol", exact: true }).waitFor();
    const statusSelect = page.getByLabel("Holat");
    assert.equal(await statusSelect.locator("option").count(), 1);
    assert.equal(await statusSelect.inputValue(), "OCCUPIED");
    assert.ok(await page.getByRole("link", { name: "Qo'shimcha #302" }).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    await Promise.all([
      page.waitForURL(`**/admin/branches/${branch.id}/halls/${hall.id}`),
      page.getByRole("link", { name: "Orqaga" }).click(),
    ]);
    await page.getByRole("heading", { name: hall.name, exact: true }).waitFor();
    console.log(`admin spaces ${viewport.width}: ok`);
    await page.close();
  }
} finally {
  await browser.close();
}
