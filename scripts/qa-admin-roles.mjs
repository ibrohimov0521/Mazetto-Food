import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const permissions = [
  { id: "all", code: "*", name: "Barcha huquqlar" },
  { id: "menu-view", code: "MENU_VIEW", name: "Menyuni ko'rish" },
  { id: "order-view", code: "ORDER_VIEW", name: "Buyurtmalarni ko'rish" },
];
const roles = [
  { id: "super", code: "SUPER_ADMIN", name: "Super Admin", isSystem: true, isBranchScoped: false, permissions: [{ permission: permissions[0] }] },
  { id: "custom", code: "CUSTOM_ORDER", name: "Buyurtma nazorati", description: "Faqat kuzatish", isSystem: false, isBranchScoped: true, permissions: [{ permission: permissions[2] }] },
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
    await page.addInitScript(() => localStorage.setItem("mazetto.auth.session", JSON.stringify({
      user: { id: "qa-admin", email: "qa@local.preview", roles: ["SUPER_ADMIN"], permissions: ["*"], branchId: null },
      tokens: { accessToken: "qa", refreshToken: "qa", tokenType: "Bearer" },
    })));
    const fulfill = (route, data) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    await page.route("**/api/v1/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/roles")) return fulfill(route, roles);
      if (url.pathname.endsWith("/permissions")) return fulfill(route, permissions);
      return fulfill(route, {});
    });

    await page.goto(`${baseUrl}/admin/roles`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { level: 1, name: "Rollar" }).waitFor();
    await page.getByRole("button", { name: "Yangi maxsus rol" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Tahrirlash" }).count(), 1);
    await page.getByRole("button", { name: "Tahrirlash" }).click();
    const dialog = page.getByRole("dialog");
    assert.equal(await dialog.getByLabel("Rol nomi").inputValue(), "Buyurtma nazorati");
    assert.equal(await dialog.getByRole("checkbox", { name: "Filial doirasidagi rol" }).isChecked(), true);
    assert.equal(await dialog.getByRole("checkbox", { name: "Buyurtmalarni ko'rish" }).isChecked(), true);
    assert.equal(await dialog.getByRole("checkbox", { name: "Barcha huquqlar" }).count(), 0);
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll("*")]
        .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 30)
        .map((element) => ({
          tag: element.tagName,
          className: String(element.className).slice(0, 120),
          text: String(element.textContent).trim().slice(0, 60),
          left: Math.round(element.getBoundingClientRect().left),
          width: Math.round(element.getBoundingClientRect().width),
          right: Math.round(element.getBoundingClientRect().right),
        })),
    }));
    assert.ok(metrics.scrollWidth <= metrics.viewport + 1, JSON.stringify(metrics));
    await dialog.getByRole("button", { name: "Bekor qilish" }).click();
    console.log(`admin roles ${viewport.width}: ok`);
    await page.close();
  }
} finally {
  await browser.close();
}
