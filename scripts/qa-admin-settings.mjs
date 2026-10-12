import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://127.0.0.1:3001";
const settings = [
  {
    key: "customer_delivery_enabled",
    value: "true",
    isStored: true,
    isPublic: true,
    affectsCustomer: true,
    rule: { kind: "bool", fallback: false },
    fallback: "false",
  },
  {
    key: "customer_delivery_fee",
    value: "20000",
    isStored: true,
    isPublic: true,
    affectsCustomer: true,
    rule: { kind: "int", min: 0, max: 1000000, fallback: 20000 },
    fallback: "20000",
  },
  {
    key: "customer_free_delivery_radius_meters",
    value: "1000",
    isStored: true,
    isPublic: false,
    affectsCustomer: true,
    rule: { kind: "int", min: 0, max: 50000, fallback: 1000 },
    fallback: "1000",
  },
  {
    key: "login_throttle_window_minutes",
    value: "15",
    isStored: false,
    isPublic: false,
    affectsCustomer: false,
    rule: { kind: "int", min: 1, max: 1440, fallback: 15 },
    fallback: "15",
  },
  {
    key: "cashier_payment_methods",
    value: "CASH",
    isStored: true,
    isPublic: false,
    affectsCustomer: false,
    rule: {
      kind: "csv-enum",
      values: ["CASH", "CARD", "UZCARD", "HUMO", "CLICK", "PAYME", "ONLINE"],
      fallback: "CASH",
    },
    fallback: "CASH",
  },
  {
    key: "order_display_number_start",
    value: "101",
    isStored: false,
    isPublic: false,
    affectsCustomer: false,
    rule: { kind: "int", min: 1, max: 1000000, fallback: 101 },
    fallback: "101",
  },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 768, height: 900 },
    { width: 360, height: 780 },
    { width: 320, height: 700 },
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    let savedValue = null;
    let savedCashierMethods = null;
    let cashierMethods = "CASH";

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
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/settings") && request.method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: settings.map((row) =>
              row.key === "cashier_payment_methods"
                ? { ...row, value: cashierMethods }
                : row,
            ),
          }),
        });
      }
      if (
        url.pathname.endsWith("/settings/cashier_payment_methods") &&
        request.method() === "PATCH"
      ) {
        savedCashierMethods = JSON.parse(request.postData() ?? "{}").value;
        cashierMethods = savedCashierMethods;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { value: cashierMethods },
          }),
        });
      }
      if (
        url.pathname.endsWith(
          "/settings/customer_free_delivery_radius_meters",
        ) &&
        request.method() === "PATCH"
      ) {
        savedValue = JSON.parse(request.postData() ?? "{}").value;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: { value: savedValue } }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto(`${baseUrl}/admin/settings`, {
      waitUntil: "domcontentloaded",
    });
    for (const method of [
      { label: "Naqd pul", pattern: /^Naqd pul$/i },
      { label: "Bank kartasi (terminal)", pattern: /^Bank kartasi \(terminal\)$/i },
      { label: "Uzcard", pattern: /^Uzcard$/i },
      { label: "Humo", pattern: /^Humo$/i },
      { label: "Click", pattern: /^Click$/i },
      { label: "Payme", pattern: /^Payme$/i },
      { label: "Onlayn to'lov", pattern: /^(Onlayn to'lov|ONLINE)$/i },
    ]) {
      const methodButton = page.getByRole("button", {
        name: method.pattern,
      });
      await methodButton.waitFor({ state: "visible" });
      assert.ok(
        await methodButton.isVisible(),
        `to'lov usuli ko'rinmadi: ${method.label}`,
      );
    }
    assert.equal(
      await page
        .getByLabel("Buyurtma raqamining boshlanishi")
        .inputValue(),
      "101",
    );
    await page.getByLabel("Tekin yetkazish radiusi").fill("1500");
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();
    await page
      .getByRole("heading", { name: "Tekin yetkazish radiusi — tasdiqlash" })
      .waitFor();
    assert.equal(
      savedValue,
      null,
      "tasdiqlashdan oldin PATCH yuborilmasligi kerak",
    );
    assert.ok(
      await page.getByText("Yangi qiymat").isVisible(),
      "tasdiqlash oynasi yangi qiymatni ko'rsatishi kerak",
    );
    await page
      .getByRole("button", { name: "Tasdiqlayman va saqlayman" })
      .click();
    await page.waitForFunction(() =>
      document.body.innerText.includes("Sozlama saqlandi"),
    );
    assert.equal(savedValue, "1500");

    await page.getByRole("button", { name: "Click", exact: true }).click();
    const enableClickSave = page.waitForResponse(
      (response) =>
        response.url().includes("/settings/cashier_payment_methods") &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();
    await enableClickSave;
    assert.equal(savedCashierMethods, "CASH,CLICK");

    await page.reload({ waitUntil: "domcontentloaded" });
    const clickMethod = page.getByRole("button", {
      name: "Click",
      exact: true,
    });
    await clickMethod.waitFor();
    assert.equal(await clickMethod.getAttribute("aria-pressed"), "true");

    await page.getByRole("button", { name: "Payme", exact: true }).click();
    const enablePaymeSave = page.waitForResponse(
      (response) =>
        response.url().includes("/settings/cashier_payment_methods") &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();
    await enablePaymeSave;
    assert.equal(savedCashierMethods, "CASH,CLICK,PAYME");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "Payme", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Payme", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );

    await clickMethod.click();
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "Kassada qabul qilinadigan to'lovlar — tasdiqlash",
      })
      .waitFor();
    assert.equal(
      savedCashierMethods,
      "CASH,CLICK,PAYME",
      "offline xavf tasdiqlanmaguncha sozlama saqlanmasligi kerak",
    );
    const confirmationDialog = page.getByRole("dialog");
    assert.ok(await confirmationDialog.isVisible());
    assert.match(
      await confirmationDialog.innerText(),
      /Oflayn Desktop kassa/,
      "o'chirilayotgan to'lov usuli uchun offline ogohlantirishi ko'rinishi kerak",
    );
    const disableClickSave = page.waitForResponse(
      (response) =>
        response.url().includes("/settings/cashier_payment_methods") &&
        response.request().method() === "PATCH",
    );
    await page
      .getByRole("button", { name: "Tasdiqlayman va saqlayman" })
      .click();
    await disableClickSave;
    assert.equal(savedCashierMethods, "CASH,PAYME");

    await page.getByRole("button", { name: "Payme", exact: true }).click();
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "Kassada qabul qilinadigan to'lovlar — tasdiqlash",
      })
      .waitFor();
    const disablePaymeSave = page.waitForResponse(
      (response) =>
        response.url().includes("/settings/cashier_payment_methods") &&
        response.request().method() === "PATCH",
    );
    await page
      .getByRole("button", { name: "Tasdiqlayman va saqlayman" })
      .click();
    await disablePaymeSave;
    assert.equal(savedCashierMethods, "CASH");
    assert.equal(
      await page
        .getByRole("button", { name: "Naqd pul", exact: true })
        .isDisabled(),
      true,
      "oxirgi yoqilgan to'lov usuli o'chirilmasligi kerak",
    );

    cashierMethods = "UNKNOWN";
    await page.reload({ waitUntil: "domcontentloaded" });
    const cashMethod = page.getByRole("button", {
      name: "Naqd pul",
      exact: true,
    });
    await cashMethod.waitFor();
    assert.equal(
      await cashMethod.getAttribute("aria-pressed"),
      "false",
      "noma'lum saqlangan qiymat to'lov usulini o'zidan-o'zi yoqmasligi kerak",
    );
    await cashMethod.click();
    const repairCashSetting = page.waitForResponse(
      (response) =>
        response.url().includes("/settings/cashier_payment_methods") &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();
    await repairCashSetting;
    assert.equal(savedCashierMethods, "CASH");

    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `${viewport.width}px da gorizontal overflow bor`,
    );

    console.log(`admin settings ${viewport.width}: ok`);
    await page.close();
  }
} finally {
  await browser.close();
}
