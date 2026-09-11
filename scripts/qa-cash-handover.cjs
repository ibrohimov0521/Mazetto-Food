const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const { chromium } = createRequire(root + '/package.json')('playwright');
const source = fs.readFileSync(root + '/scripts/qa-staff-workspaces.mjs', 'utf8');
const start = source.indexOf('const productData =');
const end = source.indexOf('const browser =');
assert.ok(start >= 0 && end > start);
const { fixtures, session } = new Function(source.slice(start, end) + '; return { fixtures, session };')();
const base = process.env.QA_STAFF_URL || 'http://127.0.0.1:3111';
const out = process.env.QA_OUTPUT || '/tmp/mazetto-phone-cash-qa';
fs.mkdirSync(out, { recursive: true });
const results = [];
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [320, 390, 1440]) {
      for (const role of ['KITCHEN', 'COURIER', 'CASHIER']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const shift = fixtures().shift;
        shift.outgoingCashTransfers = [];
        const pending = [{ id: 't-in', amount: '50000', createdAt: new Date().toISOString(), fromShift: { employee: { firstName: 'Test', lastName: 'Xodim' } } }];
        const permissions = ['SHIFT_VIEW_OWN', 'SHIFT_OPEN', 'SHIFT_CLOSE', 'CASH_TRANSACTION_CREATE'];
        if (role === 'CASHIER') permissions.push('POS_USE');
        await context.addInitScript(value => localStorage.setItem('mazetto.auth.session', JSON.stringify(value)), { ...session, user: { ...session.user, roles: [role], permissions } });
        const reads = [], writes = [], errors = [];
        await context.route('**/*', async route => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.pathname.includes('/api/v1/')) {
            const api = url.pathname.replace('/api/v1', '');
            const ok = data => route.fulfill({ json: { success: true, data } });
            if (request.method() === 'GET') {
              reads.push(api);
              if (api === '/cash-register/shift') return ok(shift);
              if (api === '/cash-register/transfers/pending') return ok(pending);
              if (api === '/cash-register/transfers/receivers') return ok([{ shiftId: 's-receiver', employeeId: 'receiver', firstName: 'QA', lastName: 'Kassir', employeeCode: 'QA-CASHIER' }]);
              if (api === '/branches') return ok([shift.branch]);
              return ok([]);
            }
            writes.push({ api, body: request.postDataJSON() });
            if (api === '/cash-register/transfers') {
              const amount = request.postDataJSON().amount;
              shift.expectedCash = String(Number(shift.expectedCash) - amount);
              shift.outgoingCashTransfers.push({ id: 't-out', amount: String(amount), status: 'PENDING', createdAt: new Date().toISOString() });
              return ok(shift.outgoingCashTransfers.at(-1));
            }
            if (/\/transfers\/t-in\/(accept|reject)$/.test(api)) { pending.length = 0; return ok({}); }
            return route.fulfill({ status: 409, json: { success: false, error: { message: 'QA: bu amal taqiqlangan' } } });
          }
          return ['GET', 'HEAD', 'OPTIONS'].includes(request.method()) ? route.continue() : route.abort();
        });
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(base + '/shift', { waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: 'Kassirga pul topshirish' }).waitFor();
        assert.equal(reads.includes('/cash-register/transfers/pending'), role === 'CASHIER');
        await page.getByRole('button', { name: 'Barcha naqd', exact: true }).click();
        await page.getByRole('button', { name: 'Topshirish', exact: true }).click();
        assert.equal(writes.length, 0);
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        await page.keyboard.press('Escape');
        assert.equal(await dialog.count(), 0);
        await page.getByRole('button', { name: 'Topshirish', exact: true }).click();
        await dialog.getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
        await page.getByText("Kassir tasdig'i kutilmoqda", { exact: true }).waitFor();
        assert.equal(writes.length, 1);
        assert.equal(writes[0].body.amount, 460000);
        assert.equal(writes[0].body.toShiftId, 's-receiver');
        assert.equal(await page.getByRole('button', { name: 'Barcha naqd', exact: true }).isDisabled(), true);
        if (role === 'CASHIER') {
          await page.getByRole('button', { name: 'Qabul qilish', exact: true }).click();
          assert.equal(writes.length, 1);
          await dialog.getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
          await page.waitForTimeout(200);
          assert.equal(writes.at(-1).api, '/cash-register/transfers/t-in/accept');
        }
        assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: out + '/cash-' + role + '-' + width + '.png', fullPage: true });
        results.push({ role, width, result: 'PASS', checks: 'role-specific API, shared handover, confirmation, cancellation, updated balance/history, no overflow/runtime errors' });
        console.log(JSON.stringify(results.at(-1)));
        await context.close();
      }
    }
  } finally { fs.writeFileSync(out + '/cash-results.json', JSON.stringify(results, null, 2)); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
