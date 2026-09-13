import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
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
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 768, height: 900 },
    { width: 360, height: 780 },
    { width: 320, height: 700 },
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    let savedValue = null;

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
          body: JSON.stringify({ success: true, data: settings }),
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
