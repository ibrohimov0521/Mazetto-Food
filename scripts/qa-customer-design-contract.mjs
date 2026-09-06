/* global document, getComputedStyle, localStorage, window */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = new URL(globalThis.process.env.QA_BASE || 'http://localhost:3107');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Local preview only');
const output = fileURLToPath(new URL('../.qa-screenshots/', import.meta.url));
await mkdir(output, { recursive: true });
const result = { checks: [], pageErrors: [], blockedMutations: [] };
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 430, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('mazetto.customer.splash.seen', '1'));
    await context.route('**/*', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        result.blockedMutations.push(new URL(route.request().url()).pathname);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => result.pageErrors.push(error.message));
    await page.goto(base.href);
    await page.locator('.mf-home-hero-media img').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.mf-home-hero-media img')].every(i => i.complete && i.naturalWidth));
    assert.equal(await page.locator('.mf-home-hero-media img').evaluate(i => getComputedStyle(i).objectFit), 'contain', 'Hero must show the complete food image');
    assert.equal(await page.locator('.mf-home-hero-media').evaluate(i => getComputedStyle(i).borderRadius), '0px', 'Do not crop food with an organic mask');
    const home = await page.evaluate(() => {
      const cta = document.querySelector('.mf-home-order-cta');
      const hero = document.querySelector('.mf-home-hero');
      const branch = document.querySelector('.mf-home-branch-row');
      return {
        background: getComputedStyle(document.querySelector('.mf-route-content')).backgroundColor,
        mask: getComputedStyle(cta, '::before').maskImage,
        ctaHeight: cta.getBoundingClientRect().height,
        ctaWeight: getComputedStyle(cta).fontWeight,
        branchBelowHero: branch.getBoundingClientRect().top >= hero.getBoundingClientRect().bottom,
        decorationsInert: [...document.querySelectorAll('.mf-botanical-frame')].every(e => e.getAttribute('aria-hidden') === 'true' && getComputedStyle(e).pointerEvents === 'none'),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    assert.equal(home.background, 'rgb(245, 245, 239)');
    assert(home.mask.includes('botanical-sprig.svg'));
    assert(home.ctaHeight >= 44 && home.ctaHeight < 60);
    assert(Number(home.ctaWeight) >= 700, 'Base form reset must not override button typography');
    assert(home.branchBelowHero && home.decorationsInert && !home.overflow);
    await page.screenshot({ path: `${output}/design-contract-home-${width}.png` });
    assert.equal(await page.locator('[data-home-slider]').count(), 1, 'One hero, not duplicate oversized banners');
    const featuredTop = await page.locator('.mf-home-products [data-product-card]').first().boundingBox();
    assert(featuredTop && featuredTop.y < 800, 'Real products must reach the first viewport');
    const feature = page.locator('[data-home-slider]');
    if (await feature.count()) {
      const next = page.getByRole('button', { name: 'Keyingi slayd', exact: true });
      if (await next.count()) {
        const arrow = await next.evaluate(e => ({ color: getComputedStyle(e).color, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }));
        assert.equal(arrow.color, 'rgb(7, 55, 58)');
        assert.equal(arrow.width, 44);
        assert.equal(arrow.height, 44);
        const oldTitle = await feature.locator('h1').innerText();
        await next.click();
        await page.waitForFunction(old => document.querySelector('[data-home-slider] h1')?.textContent !== old, oldTitle);
        const dots = page.locator('.mf-hero-dot');
        assert.equal(await dots.count(), 5, 'All existing home slides remain available');
        for (let index = 0; index < await dots.count(); index++) {
          await dots.nth(index).click();
          const geometry = await feature.evaluate(e => {
            const copy = e.querySelector('.mf-hero-copy').getBoundingClientRect();
            const title = e.querySelector('h1').getBoundingClientRect();
            const image = e.querySelector('.mf-home-hero-media').getBoundingClientRect();
            const cta = e.querySelector('.mf-home-order-cta').getBoundingClientRect();
            return {titleFits: title.right <= image.left && title.left >= copy.left, ctaFits: cta.right <= image.left, overflow: document.documentElement.scrollWidth > window.innerWidth};
          });
          assert(geometry.titleFits && geometry.ctaFits && !geometry.overflow, `Slide ${index} content must not overlap image`);
        }
      }
    }
    await page.goto(new URL('/menu', base).href);
    await page.waitForFunction(() => document.querySelectorAll('[data-product-card]').length === 74);
    const count = await page.locator('[data-product-card]').count();
    assert.equal(count, 74);
    const firstCard = page.locator('[data-product-card]').first();
    const card = await firstCard.evaluate(e => ({ radius: getComputedStyle(e).borderRadius, textWidth: e.querySelector('.mf-product-title').getBoundingClientRect().width, cardWidth: e.getBoundingClientRect().width }));
    assert.equal(card.radius, '16px');
    assert(card.textWidth > card.cardWidth * 0.75, 'Product title must not be squeezed by a badge');
    if (width >= 768) {
      await firstCard.scrollIntoViewIfNeeded();
      await page.mouse.move(width - 1, 899);
      await page.waitForTimeout(600);
      const beforeHover = await firstCard.boundingBox();
      await firstCard.hover();
      await page.waitForTimeout(800);
      const afterHover = await firstCard.boundingBox();
      assert(Math.abs(beforeHover.width - afterHover.width) < 0.1, 'Hover must not rescale the card');
      assert(Math.abs(beforeHover.height - afterHover.height) < 0.1);
      assert(Math.abs(beforeHover.y - afterHover.y - 5) < 0.1, 'Preserve the 5px lift');
      const media = await firstCard.locator('.mf-product-media').evaluate(e => ({
        transform: getComputedStyle(e).transform,
        imageScale: getComputedStyle(e.querySelector('img')).scale,
      }));
      assert.equal(media.transform, 'none', 'No second media transform during hover');
      assert.equal(media.imageScale, 'none');
      await page.mouse.move(width - 1, 899);
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    const nav = page.locator('.mf-bottom-nav');
    const before = await nav.boundingBox();
    await page.screenshot({ path: `${output}/design-contract-menu-${width}.png` });
    await page.getByRole('button', { name: 'Lavashlar', exact: true }).click();
    await page.waitForTimeout(800);
    const sticky = await page.locator('.mf-menu-sticky').evaluate(e => ({
      background: getComputedStyle(e).backgroundColor,
      blur: getComputedStyle(e).backdropFilter,
      top: e.getBoundingClientRect().top,
      header: document.querySelector('header').getBoundingClientRect().bottom,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
    assert.equal(sticky.background, 'rgba(0, 0, 0, 0)');
    assert.equal(sticky.blur, 'none');
    assert(!sticky.overflow);
    if (width >= 768) assert(Math.abs(sticky.top - sticky.header) < 1);
    else assert.deepEqual(await nav.boundingBox(), before, 'Bottom navigation must not drift');
    await page.screenshot({ path: `${output}/design-contract-sticky-${width}.png` });
    result.checks.push({ width, home, featuredTop: featuredTop.y, card, sticky, count });
    await context.close();
  }
  assert.deepEqual(result.pageErrors, []);
  assert.deepEqual(result.blockedMutations, []);
  await writeFile(`${output}/design-contract-results.json`, JSON.stringify(result, null, 2));
  globalThis.console.log('PASS: four viewports, reference tokens, button mask, arrows, title geometry, 74 products, sticky/no-blur and fixed bottom navigation.');
} finally {
  await browser.close();
}
