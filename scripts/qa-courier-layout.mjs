import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const outputDir = path.join(os.tmpdir(), "mazetto-role-layout");
const orders = Array.from({ length: 7 }, (_, index) => ({
  id: `qa-delivery-${index}`,
  status: index === 2 ? "PREPARING" : index % 2 ? "SERVED" : "READY",
  createdAt: "2026-09-13T08:30:00.000Z",
  deliveryAddress: `${index + 10}-uy, Amir Temur ko'chasi, Toshkent`,
  deliveryLocation: { lat: 41.3275 + index / 100, lng: 69.2812 },
  distanceKm: 2.3 + index,
  customer: { name: `Mijoz ${index + 1}`, phone: "+998901234567" },
  branch: { name: "Sergeli" },
  notes: index === 1 ? "Qo'ng'iroq qilmang" : null,
  order: {
    orderNumber: `${301 + index}`,
    status: index === 2 ? "PREPARING" : index % 2 ? "SERVED" : "READY",
    total: "180000",
    paymentStatus: index === 0 ? "SUCCESS" : "PENDING",
    outstandingAmount: index === 0 ? "0" : index === 1 ? "45000" : "180000",
    items: [
      { id: `item-${index}-1`, productName: "Tandir lavash", quantity: "2", totalPrice: "120000" },
      { id: `item-${index}-2`, productName: "Coca-Cola", quantity: "1", totalPrice: "60000" },
    ],
  },
}));

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
    let cash = 100000;
    let transferPayload;
    let statusPayload;
    await page.addInitScript(() => {
      window.localStorage.setItem("mazetto.auth.session", JSON.stringify({
        user: { id: "qa-admin", email: "qa@local.preview", roles: ["SUPER_ADMIN"], permissions: ["*"] },
        tokens: { accessToken: "qa", refreshToken: "qa", tokenType: "Bearer" },
      }));
    });
    const fulfill = (route, data) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data }),
    });
    await page.route("**/api/v1/courier/orders?*", (route) => fulfill(route, orders));
    await page.route("**/api/v1/cash-register/courier-shift", (route) =>
      fulfill(route, { id: "qa-courier-shift", shiftNumber: 7, currentCash: String(cash), status: "OPEN" }),
    );
    await page.route("**/api/v1/cash-register/transfers/receivers", (route) =>
      fulfill(route, [{ shiftId: "qa-cashier-shift", firstName: "Aziza", lastName: "Aliyeva", employeeCode: "CA-1" }]),
    );
    await page.route("**/api/v1/cash-register/courier-shift/transfers", async (route) => {
      transferPayload = route.request().postDataJSON();
      cash -= transferPayload.amount;
      await fulfill(route, { id: "qa-transfer" });
    });
    await page.route("**/api/v1/courier/orders/*/status", async (route) => {
      statusPayload = route.request().postDataJSON();
      await fulfill(route, { id: "qa-updated-delivery" });
    });
    await page.goto(`${baseUrl}/courier`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Yetkazib berishlar" }).waitFor();
    await page.getByRole("heading", { name: "#301" }).waitFor();
    assert.equal(await page.getByText(/Naqd:.*45.*000/).count(), 1);
    assert.equal(await page.getByText("To'langan", { exact: true }).count(), 1);
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      cards: document.querySelectorAll('section[aria-label="Yetkazish buyurtmalari"] article').length,
      overflowingCards: [...document.querySelectorAll('section[aria-label="Yetkazish buyurtmalari"] article')]
        .filter((card) => card.getBoundingClientRect().right > innerWidth + 1).length,
    }));
    assert.equal(metrics.cards, orders.length);
    assert.ok(metrics.scrollWidth <= metrics.viewport + 1, JSON.stringify(metrics));
    assert.equal(metrics.overflowingCards, 0, JSON.stringify(metrics));
    await page.screenshot({ path: path.join(outputDir, `courier-${viewport.width}.png`), fullPage: false });
    if (viewport.width === 360) {
      await page.getByRole("button", { name: "Kassani boshqarish" }).click();
      await page.getByRole("combobox", { name: "Pulni qabul qiladigan kassir" }).selectOption("qa-cashier-shift");
      const amount = page.getByRole("spinbutton", { name: "Kassirga topshiriladigan summa" });
      await amount.fill("120000");
      assert.equal(await page.getByRole("button", { name: "Kassirga topshirish" }).isDisabled(), true);
      await amount.fill("45000");
      await page.getByRole("button", { name: "Kassirga topshirish" }).click();
      await page.getByText(/55.*000/).first().waitFor();
      assert.deepEqual(transferPayload, {
        amount: 45000,
        toShiftId: "qa-cashier-shift",
        reason: "Kassirga topshirish",
      });
      await page.getByRole("heading", { name: "#302" }).locator("xpath=ancestor::article")
        .getByRole("button", { name: "Yetkazildi" }).click();
      await page.getByText(/Mijozdan naqd oling:.*45.*000/).waitFor();
      await page.getByRole("button", { name: "Tasdiqlash" }).click();
      assert.deepEqual(statusPayload, {
        status: "COMPLETED",
        shiftId: "qa-courier-shift",
        paymentMethodCode: "CASH",
      });
      await page.getByRole("heading", { name: "#301" }).locator("xpath=ancestor::article")
        .getByRole("button", { name: "Yo'lga chiqdim" }).click();
      await page.getByRole("button", { name: "Tasdiqlash" }).click();
      assert.deepEqual(statusPayload, { status: "SERVED" });
    }
    console.log(`courier ${viewport.width}: ${JSON.stringify(metrics)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
