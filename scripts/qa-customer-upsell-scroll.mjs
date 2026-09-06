/* global document, window, getComputedStyle, localStorage */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = new URL(globalThis.process.env.QA_BASE || 'http://localhost:3107');
const api = new URL(globalThis.process.env.QA_API || 'http://localhost:4107/api/v1/');
for (const url of [base, api]) assert(['localhost', '127.0.0.1'].includes(url.hostname), 'Local preview only');
const output = fileURLToPath(new URL('../.qa-screenshots/', import.meta.url));
await mkdir(output, { recursive: true });
const products = (await (await globalThis.fetch(new URL('customer/menu/products', api))).json()).data;
const product = products.find(p => p.name === 'Big Lavash');
assert(product);
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [390, 430, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
    await page.addInitScript(p => {
      localStorage.setItem('mazetto.customer.cart', JSON.stringify([{
        key: 'qa-scroll-line', productId: p.id, productName: p.name, imageUrl: p.imageUrl,
        variantId: p.variants[0].id, variantName: p.variants[0].name,
        unitPrice: p.variants[0].sellingPrice, quantity: 1, modifiers: [],
      }]));
    }, product);
    await page.goto(new URL('/cart', base).href);
    const rail = page.getByRole('region', { name: "Qo'shimcha mahsulotlar", exact: true });
    await rail.waitFor();
    await rail.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const initial = await rail.evaluate(e => ({
      top: e.scrollTop, height: e.clientHeight, content: e.scrollHeight,
      xOverflow: e.scrollWidth > e.clientWidth, scrollbar: getComputedStyle(e).scrollbarWidth,
    }));
    assert(initial.content > initial.height, 'Recommendations must overflow vertically');
    assert(!initial.xOverflow, 'No clipped horizontal-only cards');
    assert.equal(initial.scrollbar, 'none');
    const pageY = await page.evaluate(() => window.scrollY);
    const box = await rail.boundingBox();
    await page.mouse.move(box.x + box.width / 2, Math.max(90, box.y + 60));
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(400);
    const wheelTop = await rail.evaluate(e => e.scrollTop);
    assert(wheelTop > 0, 'Ordinary mouse wheel must scroll recommendations');
    assert.equal(await page.evaluate(() => window.scrollY), pageY, 'At non-boundary scroll the page remains still');
    await rail.focus();
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    const keyboardTop = await rail.evaluate(e => e.scrollTop);
    assert(keyboardTop > 0, 'Keyboard scrolling remains available');
    assert(await rail.locator('article').count() > 4);
    assert.equal(await page.locator('.mf-checkout-card').first().evaluate(e => getComputedStyle(e).overflowY), 'visible');
    await page.screenshot({ path: `${output}/upsell-vertical-scroll-${width}.png` });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    results.push({ width, initial, wheelTop, keyboardTop });
    await page.close();
  }
  await writeFile(`${output}/upsell-vertical-scroll-results.json`, JSON.stringify(results, null, 2));
  globalThis.console.log(JSON.stringify(results));
} finally { await browser.close(); }
