import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POS_WEB_URL ?? "http://localhost:3001";
const categories = [
  { id: "food", parentId: null, code: "FOOD", name: "Taomlar", description: "Asosiy taomlar", imageUrl: null, isActive: true, sortOrder: 0, _count: { products: 0, children: 1 } },
  { id: "lavash", parentId: "food", code: "LAVASH", name: "Lavashlar", description: "Lavash turlari", imageUrl: null, isActive: true, sortOrder: 0, _count: { products: 1, children: 0 } },
];
const modifiers = [
  { id: "sauce", code: "SAUCE", name: "Achchiq sous", description: "Uy sousi", price: "3000", isActive: true, sortOrder: 0, _count: { products: 1 } },
];
const product = {
  id: "product-1", categoryId: "lavash", code: "BIG_LAVASH", name: "Kurinny Big Lavash", description: "Katta lavash", imageUrl: null,
  preparationTime: 12, sellingPrice: "42000", costPrice: "21000", isAvailable: true, isRecommended: true, isCombo: false, sortOrder: 1,
  catalogVisibility: "CANONICAL",
  variants: [{ id: "variant-1", code: "MAIN", name: "Asosiy", sellingPrice: "42000", costPrice: "21000", isDefault: true, isAvailable: true, sortOrder: 0 }],
  modifiers: [{ isRequired: true, minSelect: 1, maxSelect: 2, sortOrder: 0, modifier: modifiers[0] }],
  bundleItems: [], branchAvailabilities: [],
};
const branch = { id: "qa-branch", code: "SRG", name: "MAZETTO Sergeli" };

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
      localStorage.setItem("mazetto.auth.session", JSON.stringify({
        user: { id: "qa-admin", email: "qa@local.preview", roles: ["SUPER_ADMIN"], permissions: ["*"], branchId: "qa-branch" },
        tokens: { accessToken: "qa", refreshToken: "qa", tokenType: "Bearer" },
      }));
    });
    const fulfill = (route, data) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    await page.route("**/api/v1/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/menu/categories")) return fulfill(route, categories);
      if (url.pathname.endsWith("/menu/modifiers")) return fulfill(route, modifiers);
      if (url.pathname.endsWith("/menu/products/product-1")) return fulfill(route, product);
      if (url.pathname.endsWith("/branches")) return fulfill(route, [branch]);
      return fulfill(route, []);
    });

    await page.goto(`${baseUrl}/admin/categories`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { level: 1, name: "Kategoriyalar", exact: true }).waitFor();
    const childCode = page.locator("p:visible", { hasText: "Quyi bo'lim · LAVASH" }).first();
    await childCode.waitFor();
    const childIndent = await childCode.locator("..").evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingLeft));
    assert.ok(childIndent > 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('button[aria-label="Lavashlar — tahrirlash"]:visible').click();
    const categoryDialog = page.getByRole("dialog");
    assert.equal(await categoryDialog.getByLabel("Ota kategoriya").inputValue(), "food");
    await categoryDialog.getByRole("button", { name: "Bekor qilish" }).click();

    await page.goto(`${baseUrl}/admin/modifiers`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { level: 1, name: "Qo'shimchalar", exact: true }).waitFor();
    await page.getByRole("button", { name: "Yangi qo'shimcha" }).click();
    const modifierDialog = page.getByRole("dialog");
    await modifierDialog.getByLabel("Tavsif").waitFor();
    await modifierDialog.getByLabel("Saralash tartibi").waitFor();
    await modifierDialog.getByRole("checkbox", { name: "Faol" }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await modifierDialog.getByRole("button", { name: "Bekor qilish" }).click();

    await page.goto(`${baseUrl}/admin/products/product-1`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Asosiy ma'lumot" }).waitFor();
    assert.equal(await page.getByRole("checkbox", { name: "Majburiy" }).isChecked(), true);
    assert.equal(await page.getByLabel("Eng kam").inputValue(), "1");
    assert.equal(await page.getByLabel("Eng ko'p").inputValue(), "2");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log(`admin catalog ${viewport.width}: ok`);
    await page.close();
  }
} finally {
  await browser.close();
}
