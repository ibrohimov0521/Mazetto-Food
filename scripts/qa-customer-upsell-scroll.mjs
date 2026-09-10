/* global document, window, getComputedStyle, localStorage */
import assert from 'node:assert/strict';
import { URL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = new URL(globalThis.process.env.QA_BASE || 'http://127.0.0.1:3103');
const pos = new URL(globalThis.process.env.QA_POS || 'http://127.0.0.1:3104');
for (const url of [base, pos]) assert(['localhost', '127.0.0.1'].includes(url.hostname), 'Isolated frontend only');
const output = '.qa-screenshots/cart-network';
await mkdir(output, { recursive: true });
const catalog = await globalThis.fetch(new URL('/api/v1/customer/menu/products', base));
assert.equal(catalog.status, 200);
const products = (await catalog.json()).data;
const product = products.find(p => p.variants.length && !p.modifiers.length);
assert(product);
for (const url of [base, pos]) {
  const unauthorized = await globalThis.fetch(new URL('/api/v1/kitchen/orders', url));
  assert.equal(unauthorized.status, 401, 'Internal proxy must preserve authentication');
  assert.match(unauthorized.headers.get('content-type'), /application\/json/);
}
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
    await page.addInitScript(p => localStorage.setItem('mazetto.customer.cart', JSON.stringify([{
      key: 'qa-scroll-line', productId: p.id, productName: p.name, imageUrl: p.imageUrl,
      variantId: p.variants[0].id, variantName: p.variants[0].name,
      unitPrice: p.variants[0].sellingPrice, quantity: 1, modifiers: [],
    }])), product);
    await page.goto(new URL('/cart', base).href);
    const rail = page.getByRole('region', { name: "Qo'shimcha mahsulotlar", exact: true });
    await rail.waitFor();
    await page.waitForTimeout(500);
    const summary = await page.locator('.mf-cart-summary').boundingBox();
    const recommendations = await page.locator('.mf-cart-recommendations').boundingBox();
    const row = await page.locator('.mf-cart-row').first().boundingBox();
    assert(summary.y >= row.y + row.height, 'Summary follows basket items');
    if (width >= 1024) assert(recommendations.x >= summary.x + summary.width, 'Recommendations occupy right column');
    else assert(recommendations.y >= summary.y + summary.height, 'Mobile summary precedes recommendations');
    const initial = await rail.evaluate(e => ({
      height: e.clientHeight, content: e.scrollHeight, overflow: getComputedStyle(e).overflowY,
      xOverflow: e.scrollWidth > e.clientWidth,
    }));
    assert(initial.content <= initial.height + 1, 'All recommendations fit without an internal scroll');
    assert.equal(initial.overflow, 'visible');
    assert(!initial.xOverflow);
    await rail.scrollIntoViewIfNeeded();
    const pageY = await page.evaluate(() => window.scrollY);
    const box = await rail.boundingBox();
    await page.mouse.move(box.x + box.width / 2, Math.max(100, Math.min(500, box.y + 60)));
    await page.mouse.wheel(0, 180);
    await page.waitForTimeout(350);
    assert.equal(await rail.evaluate(e => e.scrollTop), 0);
    assert(await page.evaluate(() => window.scrollY) > pageY, 'Wheel over products scrolls the page');
    const action = page.getByRole('link', { name: 'Rasmiylashtirish', exact: true });
    const actionBox = await action.boundingBox();
    assert(actionBox.y >= 0 && actionBox.y + actionBox.height <= 900, 'Checkout remains visible');
    await page.screenshot({ path: `${output}/cart-${width}.png`, fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.deepEqual(errors, []);
    results.push({ width, initial });
    await page.close();
  }
  const menu = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let fail = true;
  await menu.route('**/api/v1/customer/menu/**', route => fail
    ? route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,error:{message:'QA temporary outage'}})})
    : route.continue());
  await menu.goto(new URL('/menu', base).href);
  await menu.getByRole('status').filter({hasText:'Menyu yangilanmadi'}).waitFor();
  assert(await menu.locator('[data-product-card]').count() > 5, 'Server-rendered catalog survives a failed refresh');
  fail = false;
  await menu.getByRole('button', {name:'Qayta urinish',exact:true}).click();
  await menu.getByRole('status').filter({hasText:'Menyu yangilanmadi'}).waitFor({state:'hidden'});
  assert(await menu.locator('[data-product-card]').count() > 5);
  globalThis.console.log(JSON.stringify({results, proxy:'catalog forwarded; unauthorized requests still rejected', recovery:'menu retained and retry succeeded'}, null, 2));
} finally { await browser.close(); }
