import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const branch = {
  id: "qa-branch",
  code: "SRG",
  name: "MAZETTO Sergeli",
  address: "Sergeli, Toshkent",
  phone: "+998 90 000 00 00",
  timezone: "Asia/Tashkent",
  coordinates: { latitude: 41.226, longitude: 69.219 },
  isActive: true,
  isTemporarilyClosed: false,
  acceptsOrders: true,
  deliveryEnabled: true,
  pickupEnabled: true,
  sortOrder: 0,
  workingHours: [],
  _count: { employees: 8, printers: 2, devices: 4, products: 42 },
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
            roles: ["SUPER_ADMIN"],
            permissions: ["*"],
            isGlobalScope: true,
          },
          tokens: { accessToken: "qa", refreshToken: "qa", tokenType: "Bearer" },
        }),
      );
    });
    await page.route("**/api/v1/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [branch] }),
      }),
    );

    await page.goto(`${baseUrl}/admin/branches`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("heading", { name: "Filiallar", exact: true }).waitFor();
    await page.getByRole("button", { name: "Tahrirlash" }).first().click();
    assert.equal(
      await page.getByLabel("Kenglik (latitude)").inputValue(),
      "41.226",
    );
    assert.equal(
      await page.getByLabel("Uzunlik (longitude)").inputValue(),
      "69.219",
    );
    assert.equal(
      await page.getByLabel("Vaqt mintaqasi").inputValue(),
      "Asia/Tashkent",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.getByRole("button", { name: "Bekor qilish" }).click();

    console.log(`admin branches ${viewport.width}: ok`);
    await page.close();
  }
} finally {
  await browser.close();
}
