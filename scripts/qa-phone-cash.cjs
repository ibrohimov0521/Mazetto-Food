const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const { chromium } = createRequire(root + '/package.json')('playwright');
const out = process.env.QA_OUTPUT || '/tmp/mazetto-phone-cash-qa';
fs.mkdirSync(out, { recursive: true });
const customerBase = process.env.QA_CUSTOMER_URL || 'http://127.0.0.1:3110';
const staffBase = process.env.QA_STAFF_URL || 'http://127.0.0.1:3111';
const results = [];

async function geometry(page, name) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ': horizontal overflow');
  const input = page.getByRole('textbox', { name: 'Telefon raqam', exact: true });
  if (await input.count()) {
    const box = await input.boundingBox();
    assert.ok(box && box.width >= 100, name + ': phone input too narrow');
  }
  await page.screenshot({ path: out + '/' + name + '.png', fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390, 1440]) {
      for (const kind of ['customer', 'staff']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const posts = [];
        const errors = [];
        await context.route('**/*', async route => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.pathname.includes('/api/v1/')) {
            const api = url.pathname.replace('/api/v1', '');
            if (request.method() === 'POST') {
              posts.push({ api, body: request.postDataJSON() });
              if (api === '/customer/auth/request-code') return route.fulfill({ json: { success: true, data: { challenge: { phone: '+998901234567', expiresAt: new Date(Date.now() + 300000).toISOString() }, delivery: { status: 'SENT', message: 'Test kodi yuborildi' } } } });
              return route.fulfill({ status: 400, json: { success: false, error: { message: 'QA: test hisobi' } } });
            }
            return route.fulfill({ json: { success: true, data: api.includes('settings') ? {} : [] } });
          }
          if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.abort();
          return route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        await page.goto((kind === 'customer' ? customerBase + '/profile' : staffBase + '/login'), { waitUntil: 'networkidle' });
        const phone = page.getByRole('textbox', { name: 'Telefon raqam', exact: true });
        await phone.waitFor();
        assert.equal(await phone.inputValue(), '');
        assert.ok(await page.getByText('+998', { exact: true }).count());
        await phone.fill('90123456');
        const submit = page.getByRole('button', { name: kind === 'customer' ? 'Kod olish' : 'Kirish', exact: true });
        if (kind === 'staff') {
          await page.getByLabel('Parol', { exact: true }).fill('qa-not-a-real-password');
          await submit.click();
        } else assert.equal(await submit.isDisabled(), true);
        assert.equal(posts.length, 0);
        await phone.fill('+998 90 123 45 67');
        assert.equal(await phone.inputValue(), '901234567');
        await geometry(page, kind + '-phone-' + width);
        await submit.click();
        await page.waitForTimeout(200);
        assert.equal(posts.length, 1);
        assert.equal(posts[0].body[kind === 'customer' ? 'phone' : 'identifier'], '+998901234567');
        if (kind === 'customer') {
          await page.getByRole('textbox', { name: 'Telegram tasdiqlash kodi' }).fill('123456');
          await page.getByRole('button', { name: 'Kodni tasdiqlash', exact: true }).click();
          await page.waitForTimeout(200);
          assert.equal(posts.at(-1).body.phone, '+998901234567');
        } else {
          await page.getByRole('tab', { name: 'Email', exact: true }).click();
          await page.getByRole('textbox', { name: 'Email', exact: true }).fill('qa@example.invalid');
          await page.getByRole('button', { name: 'Kirish', exact: true }).click();
          await page.waitForTimeout(200);
          assert.equal(posts.at(-1).body.identifier, 'qa@example.invalid');
          await page.getByRole('tab', { name: 'Telefon', exact: true }).click();
        }
        await phone.fill('998123456');
        assert.equal(await phone.inputValue(), '998123456');
        await phone.evaluate(el => {
          const data = new DataTransfer(); data.setData('text', '+998 (90) 765-43-21');
          el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
        });
        assert.equal(await phone.inputValue(), '907654321');
        await phone.fill('+7 999 123 45 67');
        assert.equal(await phone.inputValue(), '907654321');
        if (kind === 'customer') assert.equal(await page.getByRole('textbox', { name: 'Telegram tasdiqlash kodi' }).count(), 0);
        assert.deepEqual(errors, []);
        results.push({ kind, width, result: 'PASS', scenarios: ['empty-prefix', 'invalid-length-blocked', 'international-autofill', 'canonical-request', 'email-or-otp', 'paste', 'foreign-prefix-rejected', 'no-overflow', 'no-runtime-errors'] });
        console.log(JSON.stringify(results.at(-1)));
        await context.close();
      }
    }
  } finally {
    fs.writeFileSync(out + '/results.json', JSON.stringify(results, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
