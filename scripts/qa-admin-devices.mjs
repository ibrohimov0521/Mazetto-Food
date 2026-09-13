import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const branch = { id: "qa-branch", code: "SRG", name: "MAZETTO Sergeli" };
const devices = [
  {
    id: "device-1",
    branchId: branch.id,
    name: "Kassa 1",
    type: "POS_TERMINAL",
    os: "Android",
    ipAddress: "192.168.1.20",
    softwareVersion: "1.4.0",
    isActive: true,
    lastEmployee: {
      firstName: "Aziza",
      lastName: "Karimova",
      employeeCode: "STF-100",
    },
  },
  {
    id: "device-2",
    branchId: branch.id,
    name: "Oshxona ekrani",
    type: "KITCHEN_DISPLAY",
    os: "Windows",
    ipAddress: null,
    softwareVersion: null,
    isActive: false,
    lastEmployee: null,
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
    const fulfill = (route, data) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data }),
      });
    await page.route("**/api/v1/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/branches/qa-branch")) {
        return fulfill(route, branch);
      }
      if (url.pathname.endsWith("/devices")) {
        return fulfill(route, devices);
      }
      return fulfill(route, []);
    });

    await page.goto(
      `${baseUrl}/admin/branches/${branch.id}/devices`,
      { waitUntil: "domcontentloaded" },
    );
    await page.getByRole("heading", { name: "Qurilmalar" }).waitFor();
    assert.ok(
      await page.getByText("Kassa 1", { exact: true }).evaluateAll((nodes) =>
        nodes.some((node) => {
          const style = getComputedStyle(node);
          return style.display !== "none" && style.visibility !== "hidden";
        }),
      ),
    );
    assert.ok(
      await page.getByRole("button", { name: "Yangi qurilma" }).isVisible(),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );

    await page.getByRole("button", { name: "Yangi qurilma" }).click();
    await page.getByLabel("Qurilma nomi").fill("Kassa 2");
    assert.ok(await page.getByLabel("Turi").isVisible());
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.getByRole("button", { name: "Bekor qilish" }).click();

    console.log(`admin devices ${viewport.width}: ok`);
    await page.close();
  }
} finally {
  await browser.close();
}
