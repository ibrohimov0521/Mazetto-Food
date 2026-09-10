/* global console, document, window, localStorage, process, URL */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const web = process.argv[2] || "http://127.0.0.1:3103";
const pos = process.argv[3] || "http://127.0.0.1:3104";
const output = ".qa-screenshots/status-seo";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const checks = [];
try {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const robot = await ctx.request.get(web + "/robots.txt");
  assert.equal(robot.status(), 200);
  assert.match(await robot.text(), /Sitemap: https:\/\/mazettofood.uz\/sitemap.xml/);
  const sitemap = await ctx.request.get(web + "/sitemap.xml");
  assert.equal(sitemap.status(), 200);
  const xml = await sitemap.text();
  const paths = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(match[1]).pathname);
  assert(paths.includes("/") && paths.includes("/menu") && paths.some(path => path.startsWith("/product/")));
  assert(!paths.some(path => /cart|checkout|profile|orders/.test(path)));
  for (const path of ["/", "/menu", paths.find(path => path.startsWith("/product/"))]) {
    const response = await page.goto(web + path);
    assert.equal(response.status(), 200);
    await page.locator('link[rel="canonical"]').waitFor({ state: "attached" });
    assert.equal(new URL(await page.locator('link[rel="canonical"]').getAttribute("href")).href, "https://mazettofood.uz" + path);
    assert(await page.locator('meta[name="description"]').getAttribute("content"));
    assert(!/noindex/.test(await page.locator('meta[name="robots"]').getAttribute("content")));
    if (path.startsWith("/product/")) {
      assert(await page.locator("h1").innerText());
      const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
      assert.equal(schema["@type"], "Product");
      assert.equal(schema.offers.priceCurrency, "UZS");
    } else {
      assert(await page.locator('a[href^="/product/"]').count() > 5, "Products in initial HTML without JavaScript");
    }
  }
  for (const path of ["/cart", "/checkout", "/profile", "/orders", "/checkout/preview"]) {
    await page.goto(web + path);
    assert.match((await page.locator('meta[name="robots"]').evaluateAll(nodes => nodes.map(node => node.content))).join(","), /noindex/);
  }
  const missing = await ctx.request.get(web + "/product/qa-product-does-not-exist");
  assert.equal(missing.status(), 404);
  checks.push("Sitemap/robots, canonical metadata, private noindex, product JSON-LD, missing product 404, real product HTML without JavaScript");
  await ctx.close();

  const client = await browser.newContext({ viewport: { width: 390, height: 850 } });
  if (new URL(web).hostname === "127.0.0.1") {
    await client.route("**/api/v1/**", async route => route.fulfill({ response: await route.fetch() }));
  }
  const live = await client.newPage();
  const pageErrors = [];
  live.on("pageerror", error => pageErrors.push(error.message));
  await live.goto(web + "/menu");
  await live.locator("[data-product-card]").first().waitFor();
  await live.waitForTimeout(500);
  assert.equal(await live.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await live.screenshot({ path: output + "/menu-mobile.png" });
  await live.goto(web + paths.find(path => path.startsWith("/product/")));
  await live.locator("h1").waitFor();
  await live.waitForTimeout(500);
  await live.screenshot({ path: output + "/product-mobile.png" });
  assert.deepEqual(pageErrors, []);
  checks.push("Hydrated mobile menu/product without browser errors");
  await client.close();

  const kctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await kctx.addInitScript(() => localStorage.setItem("mazetto.auth.session", JSON.stringify({
    user: { id: "qa-kitchen", displayName: "QA", roles: ["KITCHEN"], permissions: ["KITCHEN_VIEW", "KITCHEN_ACCEPT", "KITCHEN_STATUS_UPDATE"] },
    tokens: { accessToken: "qa-only", refreshToken: "qa-only", tokenType: "Bearer" },
  })));
  let ticket = { id: "qa-ticket", ticketNumber: "QA1", status: "NEW", priority: 0, createdAt: new Date().toISOString(), order: { id: "qa-order", orderNumber: "QA1", source: "WEB", type: "DELIVERY", branch: { name: "QA" }, items: [{ id: "qa-item", productName: "Lavash", quantity: "1" }] } };
  let rejectAction = false, readFails = false, actionCount = 0;
  await kctx.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: { message: data } }) });
    if (path.endsWith("/kitchen/orders")) return readFails ? json("QA network interruption", 503) : json(ticket ? [ticket] : []);
    if (path.includes("/kitchen/orders/")) {
      actionCount++;
      if (rejectAction) { ticket = null; return json("Buyurtma bekor qilingan. Holat yangilandi.", 400); }
      ticket = { ...ticket, status: "ACCEPTED" };
      readFails = true;
      return json(ticket);
    }
    return json({});
  });
  const kitchen = await kctx.newPage();
  await kitchen.goto(pos + "/kitchen");
  await kitchen.getByRole("button", { name: "Qabul qilish", exact: true }).click();
  await kitchen.getByRole("button", { name: "Tayyorlash", exact: true }).waitFor();
  assert.equal(actionCount, 1);
  await kitchen.getByText("QA network interruption").waitFor();
  assert.equal(await kitchen.getByRole("button", { name: "Qabul qilish", exact: true }).count(), 0, "Successful action survives failed refresh");
  readFails = false; rejectAction = true;
  await kitchen.getByRole("button", { name: "Tayyorlash", exact: true }).click();
  await kitchen.getByText("Buyurtma bekor qilingan. Holat yangilandi.").waitFor();
  await kitchen.locator("article").waitFor({ state: "hidden" });
  await kitchen.screenshot({ path: output + "/kitchen-recovered.png" });
  checks.push("Kitchen action updates immediately, refresh failures preserve correct status, stale cancelled ticket disappears while action error stays visible");
  await kctx.close();
  console.log(JSON.stringify({ checks }, null, 2));
} finally { await browser.close(); }
