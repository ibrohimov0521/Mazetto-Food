/* global URL, process, localStorage, setTimeout, document, innerWidth, structuredClone, console */
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");
const base = process.argv[2] || "http://127.0.0.1:3103";
const output = "/tmp/mazetto-staff-qa";
await mkdir(output, { recursive: true });
const productData = [
  ["p1", "Big lavash", "lavash", "lavash-pishloqli.webp", 36000],
  ["p2", "Lavashlar uchligi", "sets", "set-lavashlar-juftligi.webp", 141000],
  [
    "p3",
    "Tandir lavash juftligi",
    "sets",
    "set-tandir-lavash-juftligi.webp",
    117000,
  ],
  ["p4", "Donerda baraka", "sets", "set-donerda-baraka.webp", 207000],
  ["p5", "Double chizburger", "burger", "double-chizburger.webp", 39000],
  ["p6", "Kurinniy doner", "lavash", "kurinniy-doner.webp", 32000],
  ["p7", "Shashlikli hot-dog", "burger", "shashlikli-hot-dog.webp", 28000],
  [
    "p8",
    "Pishloqli kurinniy lavash",
    "lavash",
    "kurinniy-lavash-pishloqli.webp",
    35000,
  ],
];
const catalog = {
  branchId: "qa-branch",
  categories: [
    { id: "sets", name: "Setlar" },
    { id: "lavash", name: "Lavashlar" },
    { id: "burger", name: "Burger va hot-dog" },
  ],
  products: productData.map(([id, name, categoryId, image, price], i) => ({
    id,
    name,
    categoryId,
    imageUrl: `https://media.mazettofood.uz/qa-images/${image}`,
    sellingPrice: String(i === 0 ? 30000 : price),
    isCombo: categoryId === "sets",
    preparationTime: 15,
    variants: [
      {
        id: `v-${id}`,
        name: "Standart",
        sellingPrice: String(price),
        isDefault: true,
      },
    ],
    modifiers: [],
  })),
};
catalog.products[4].variants.push({
  id: "v-p5-large",
  name: "Katta",
  sellingPrice: "45000",
  isDefault: false,
});
catalog.products[4].modifiers.push(
  {
    isRequired: true,
    modifier: { id: "required", name: "Maxsus sous", price: "2000" },
  },
  {
    isRequired: false,
    modifier: { id: "cheese", name: "Pishloq", price: "3000" },
  },
);
const fixtures = () => {
  const time = new Date(Date.now() - 8 * 60000).toISOString();
  const shift = {
    id: "s1",
    shiftNumber: 24,
    status: "OPEN",
    openingBalance: "100000",
    expectedCash: "460000",
    cashSales: "360000",
    orderCount: 10,
    openedAt: time,
    branch: {
      id: "qa-branch",
      name: "MAZETTO Sergeli",
      address: "Sergeli 7/3",
    },
    employee: { firstName: "Sinov", lastName: "Kassir" },
    cashTransactions: [
      { id: "cash1", type: "CASH_SALE", amount: "360000", occurredAt: time },
    ],
  };
  const tickets = ["NEW", "ACCEPTED", "COOKING", "READY"].map((status, i) => ({
    id: `t${i}`,
    ticketNumber: `K${101 + i}`,
    status,
    priority: 0,
    createdAt: new Date(
      Date.now() - (i === 2 ? 28 : 8 + i) * 60000,
    ).toISOString(),
    order: {
      id: `o${i}`,
      orderNumber: `000${101 + i}`,
      displayOrderNumber: `WEB${101 + i}`,
      source: i === 1 ? "POS" : i === 2 ? "TELEGRAM" : "WEB",
      type: i === 1 ? "DINE_IN" : i === 2 ? "TAKEAWAY" : "DELIVERY",
      kitchenComment: i === 0 ? "Piyozsiz tayyorlansin. Sous alohida." : null,
      branch: { name: "MAZETTO Sergeli" },
      table: i === 1 ? { number: 4, name: "Stol 4" } : null,
      items: catalog.products
        .slice(i, i + (i === 0 ? 5 : 2))
        .map((p, n) => ({
          id: `${i}-${n}`,
          productName: p.name,
          variantName: "Standart",
          quantity: String(n === 0 ? 2 : 1),
          notes: n === 1 && i === 0 ? "Achchiq bo'lmasin" : null,
          modifierSnapshot: n === 0 ? [{ name: "Pishloq", quantity: "1" }] : [],
        })),
    },
  }));
  const orders = ["READY", "PREPARING", "READY"].map((status, i) => ({
    id: `c${i}`,
    status,
    createdAt: time,
    deliveryAddress:
      i === 0
        ? "Sergeli 7/3, 28-uy, 3-xonadon"
        : i === 1
          ? "Chilonzor 19-mavze, 12-uy"
          : "Yangi Hayot tumani, Bunyodkor ko'chasi, 45-uy, 12-xonadon",
    deliveryLocation:
      i === 2 ? { lat: null, lng: null } : { lat: 41.222, lng: 69.211 },
    notes: i === 0 ? "2-podyezd, 3-qavat. Kelganda telefon qiling." : null,
    customer: {
      name: ["Aziz Karimov", "Madina Tursunova", "Sinov Uzun Familiyali Mijoz"][
        i
      ],
      phone: "+998900000000",
    },
    branch: { name: "MAZETTO Sergeli" },
    order: {
      orderNumber: `000${201 + i}`,
      displayOrderNumber: `WEB${201 + i}`,
      status,
      total: "108000",
      items: [
        {
          id: "i1",
          productName: "Big lavash",
          quantity: "3",
          totalPrice: "108000",
        },
      ],
    },
  }));
  return {
    shift,
    tickets,
    orders,
    posts: [],
    failKitchen: false,
    failCourier: false,
    failPos: false,
    failShift: false,
    slowPos: false,
    catalog,
  };
};
const session = {
  user: {
    id: "qa-staff",
    email: "sinov@mazetto.example",
    employeeId: "qa-employee",
    branchId: "qa-branch",
    roles: ["CASHIER", "KITCHEN", "COURIER"],
    permissions: [
      "POS_USE",
      "SHIFT_VIEW_OWN",
      "KITCHEN_VIEW",
      "KITCHEN_ACCEPT",
      "KITCHEN_STATUS_UPDATE",
      "COURIER_DELIVERY_VIEW",
      "COURIER_DELIVERY_UPDATE",
    ],
  },
  tokens: {
    accessToken: "qa-intercepted",
    refreshToken: "qa-intercepted",
    tokenType: "Bearer",
  },
};
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const results = [];
async function setup(width = 1440, height = 900, roles = session) {
  const state = fixtures();
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    (value) =>
      localStorage.setItem("mazetto.auth.session", JSON.stringify(value)),
    roles,
  );
  await context.route("**/qa-images/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop();
    await route.fulfill({
      contentType: "image/webp",
      body: await readFile(
        fileURLToPath(
          new URL(
            `../apps/customer-web/public/menu-media/source/products/${name}`,
            import.meta.url,
          ),
        ),
      ),
    });
  });
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    const ok = (data) => route.fulfill({ json: { success: true, data } });
    const fail = () =>
      route.fulfill({
        status: 503,
        json: { success: false, error: { message: "Sinov: aloqa uzildi" } },
      });
    if (req.method() !== "GET")
      state.posts.push({
        path,
        method: req.method(),
        body: req.postDataJSON(),
      });
    if (path === "/cash-register/shift")
      return state.failShift ? fail() : ok(state.shift);
    if (path === "/pos/catalog") return ok(state.catalog);
    if (path === "/pos/orders") {
      if (state.slowPos)
        await new Promise((resolve) => setTimeout(resolve, 350));
      if (state.failPos) return fail();
      return ok({
        order: {
          orderNumber: "QA0001",
          displayOrderNumber: "QA1",
          total: "36000",
        },
        payment: { cashReceived: "50000", change: "14000" },
      });
    }
    if (path === "/cash-register/shift/open") {
      state.shift = fixtures().shift;
      return ok(state.shift);
    }
    if (path === "/cash-register/shift/s1/close") {
      const closed = {
        ...state.shift,
        status: "CLOSED",
        closingBalance: req.postDataJSON().closingBalance,
        cashDifference: "0",
      };
      state.shift = null;
      return ok(closed);
    }
    if (path === "/kitchen/orders")
      return state.failKitchen ? fail() : ok(state.tickets);
    if (path.startsWith("/kitchen/orders/")) {
      const [, , , id, action] = path.split("/");
      const ticket = state.tickets.find((item) => item.id === id);
      ticket.status = {
        accept: "ACCEPTED",
        start: "COOKING",
        ready: "READY",
        complete: "COMPLETED",
        cancel: "CANCELLED",
      }[action];
      state.tickets = state.tickets.filter(
        (item) => !["CANCELLED", "COMPLETED"].includes(item.status),
      );
      return ok(ticket);
    }
    if (path === "/courier/orders")
      return state.failCourier ? fail() : ok(state.orders);
    if (path.startsWith("/courier/orders/")) {
      const id = path.split("/")[3];
      state.orders = state.orders.filter((item) => item.id !== id);
      return ok({ id, status: req.postDataJSON().status });
    }
    throw new Error(`Unexpected intercepted API: ${req.method()} ${path}`);
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, state, errors };
}
async function visit(page, path) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.locator("header img").evaluate((img) => img.decode());
}
async function screenshot(page, name) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
}
async function checkLayout(page, label) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    `${label}: page overflow`,
  );
  const bad = await page
    .locator("main button, main h1, main h2, main h3, main input")
    .evaluateAll((nodes) =>
      nodes
        .filter((el) => {
          const box = el.getBoundingClientRect();
          if (!box.width || !box.height) return false;
          const scrollParent = el.closest("nav");
          if (
            scrollParent &&
            scrollParent.scrollWidth > scrollParent.clientWidth
          )
            return false;
          return box.left < -2 || box.right > innerWidth + 2;
        })
        .map((el) => ({ text: el.textContent, tag: el.tagName }))
        .slice(0, 8),
    );
  assert.deepEqual(bad, [], `${label}: offscreen controls`);
}
try {
  for (const [width, height] of [
    [320, 780],
    [390, 844],
    [768, 900],
    [1024, 680],
    [1440, 900],
  ]) {
    const { context, page, errors } = await setup(width, height);
    for (const [path, title] of [
      ["/kitchen", "Oshxona"],
      ["/courier", "Kuryer"],
      ["/pos", "Kassa"],
      ["/shift", "Kassa smenasi"],
    ]) {
      await visit(page, path);
      assert.equal(
        await page
          .getByRole("heading", { name: title, exact: true, level: 1 })
          .count(),
        1,
      );
      assert.equal(
        await page
          .getByRole("navigation", { name: "Ruxsat berilgan panellar" })
          .count(),
        1,
      );
      assert.equal(
        await page
          .getByRole("navigation", { name: "Ruxsat berilgan panellar" })
          .getByRole("link")
          .count(),
        3,
        "One link per staff workspace",
      );
      await screenshot(page, `${path.slice(1)}-${width}`);
      await checkLayout(page, `${path}-${width}`);
      if (path === "/pos") {
        await page
          .getByRole("button", { name: "Big lavash,", exact: false })
          .click();
        await page
          .getByRole("button", { name: "Lavashlar uchligi,", exact: false })
          .click();
        if (width < 768)
          await page
            .getByRole("button", { name: "Buyurtma", exact: true })
            .click();
        await page
          .getByRole("spinbutton", { name: "Qabul qilingan naqd pul" })
          .fill("200000");
        await checkLayout(page, `pos-filled-${width}`);
      }
      await screenshot(page, `${path.slice(1)}-${width}`);
    }
    assert.deepEqual(errors, [], `runtime errors at ${width}`);
    results.push({
      width,
      height,
      checked:
        "kitchen, courier, POS, shift; role links; loaded logo; no overflow",
      errors,
    });
    await context.close();
  }
  {
    const { context, page, state, errors } = await setup();
    await visit(page, "/kitchen");
    const first = page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", { name: "#WEB101", exact: true }),
      });
    await first.getByRole("button", { name: "Yana 2 ta mahsulot" }).click();
    await first.getByText("Double chizburger", { exact: false }).waitFor();
    await first
      .getByRole("button", { name: "Qabul qilish", exact: true })
      .click();
    await first
      .getByRole("button", { name: "Tayyorlash", exact: true })
      .waitFor();
    await first
      .getByRole("button", { name: "Tayyorlash", exact: true })
      .click();
    await first.getByRole("button", { name: "Tayyor", exact: true }).waitFor();
    await first.getByRole("button", { name: "Tayyor", exact: true }).click();
    await first
      .getByRole("button", { name: "Topshirish", exact: true })
      .waitFor();
    await first
      .getByRole("button", { name: "Topshirish", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "#WEB101", exact: true })
      .waitFor({ state: "detached" });
    await page
      .getByRole("button", { name: "#WEB102 buyurtmani bekor qilish" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Ortga" })
      .click();
    assert.equal(
      state.posts.filter((p) => p.path.endsWith("/cancel")).length,
      0,
    );
    await page
      .getByRole("button", { name: "#WEB102 buyurtmani bekor qilish" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Bekor qilish", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page
      .getByRole("heading", { name: "#WEB102", exact: true })
      .waitFor({ state: "detached" });
    state.failKitchen = true;
    await page.getByRole("button", { name: "Yangilash", exact: true }).click();
    await page.locator('main [role="alert"]').waitFor();
    assert.equal(
      await page.getByRole("heading", { name: "#WEB103", exact: true }).count(),
      1,
    );
    state.failKitchen = false;
    await page.getByRole("button", { name: "Yangilash", exact: true }).click();
    await page.locator('main [role="alert"]').waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "Kuryer", exact: true }).click();
    await page.getByRole("heading", { name: "Kuryer", level: 1 }).waitFor();
    results.push({
      flow: "Kitchen accept/start/ready/handoff; cancel confirmation; connection recovery; role switch",
      passed: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { context, page, state, errors } = await setup(390, 844);
    await visit(page, "/courier");
    const card = page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", { name: "#WEB201", exact: true }),
      });
    const waiting = page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", { name: "#WEB202", exact: true }),
      });
    assert(
      await waiting
        .getByRole("button", { name: "Oshxonada tayyorlanmoqda" })
        .isDisabled(),
    );
    const noPoint = page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", { name: "#WEB203", exact: true }),
      });
    assert.equal(
      await noPoint.getByRole("link", { name: "Google Maps" }).count(),
      0,
      "Null coordinates must not become 0,0",
    );
    assert.match(
      await card
        .getByRole("link", { name: "Google Maps" })
        .getAttribute("href"),
      /41.222%2C69.211/,
    );
    assert.equal(
      await card.getByRole("link", { name: /qo'ng'iroq/ }).getAttribute("href"),
      "tel:+998900000000",
    );
    await page
      .getByRole("textbox", { name: "Buyurtma, mijoz yoki manzil qidirish" })
      .fill("WEB201");
    assert.equal(await page.getByRole("article").count(), 1);
    await page
      .getByRole("textbox", { name: "Buyurtma, mijoz yoki manzil qidirish" })
      .fill("");
    await card.getByRole("button", { name: "Yetkazildi", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await screenshot(page, "courier-confirmation-mobile");
    await page.keyboard.press("Escape");
    assert.equal(state.posts.length, 0);
    await card.getByRole("button", { name: "Yetkazildi", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Tasdiqlash", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "#WEB201", exact: true })
      .waitFor({ state: "detached" });
    assert.equal(state.posts.length, 1);
    assert.equal(state.posts[0].body.status, "COMPLETED");
    results.push({
      flow: "Courier search, correct navigation, null coordinates, preparation guard, confirmation, completion",
      passed: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { context, page, state, errors } = await setup();
    await visit(page, "/pos");
    await page
      .getByRole("button", { name: "Big lavash,", exact: false })
      .click();
    const receipt = page.getByRole("complementary", { name: "Joriy buyurtma" });
    await receipt
      .getByText(/^36[,\s]000 so'm$/)
      .first()
      .waitFor();
    assert(
      (await receipt.getByText(/^36[,\s]000 so'm$/).count()) >= 2,
      "Default variant price shown equals cart price",
    );
    assert.equal(
      await receipt.getByText(/^30[,\s]000 so'm$/).count(),
      0,
      "Base price must not override default variant",
    );
    await receipt
      .getByRole("button", { name: "Big lavashni ko'paytirish" })
      .click();
    await receipt
      .getByRole("button", { name: "Big lavashni kamaytirish" })
      .click();
    await page
      .getByRole("button", { name: "Double chizburger,", exact: false })
      .click();
    await page.getByRole("radio", { name: /Katta/ }).check();
    await page.getByRole("checkbox", { name: /Pishloq/ }).check();
    assert(
      await page.getByRole("checkbox", { name: /Maxsus sous/ }).isChecked(),
    );
    await screenshot(page, "pos-variant-dialog");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Qo'shish", exact: true })
      .click();
    await receipt
      .getByRole("button", { name: "Double chizburgerni o'chirish" })
      .click();
    const cash = page.getByRole("spinbutton", {
      name: "Qabul qilingan naqd pul",
    });
    const pay = page.getByRole("button", {
      name: "Buyurtmani tasdiqlash",
      exact: true,
    });
    await cash.fill("-100");
    assert(await pay.isDisabled());
    await cash.fill("50000");
    state.failPos = true;
    await pay.click();
    await page.locator('main [role="alert"]').waitFor();
    const firstKey = state.posts.at(-1).body.idempotencyKey;
    state.failPos = false;
    state.slowPos = true;
    await pay.click();
    assert(
      await receipt
        .getByRole("button", { name: "Big lavashni ko'paytirish" })
        .isDisabled(),
    );
    await page.getByRole("status").waitFor();
    assert.equal(state.posts.at(-1).body.idempotencyKey, firstKey);
    assert.equal(state.posts.at(-1).body.items[0].variantId, "v-p1");
    assert.equal(state.posts.filter((p) => p.path === "/pos/orders").length, 2);
    await screenshot(page, "pos-success");
    results.push({
      flow: "POS default variant price, quantity, required modifier, invalid cash, retry idempotency, submit lock, success",
      passed: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { context, page, state, errors } = await setup(390, 844);
    state.shift = null;
    await visit(page, "/shift");
    const opening = page.getByRole("spinbutton", {
      name: "Boshlang'ich naqd summa",
    });
    await opening.fill("-5");
    assert(
      await page
        .getByRole("button", { name: "Smenani ochish", exact: true })
        .isDisabled(),
    );
    await opening.fill("100000");
    await screenshot(page, "shift-closed-mobile");
    await page
      .getByRole("button", { name: "Smenani ochish", exact: true })
      .click();
    await page.waitForURL("**/pos");
    await visit(page, "/shift");
    await page
      .getByRole("spinbutton", { name: "Haqiqiy naqd summa" })
      .fill("460000");
    await page
      .getByRole("button", { name: "Smenani yopish", exact: true })
      .click();
    await screenshot(page, "shift-confirmation-mobile");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Yakunlash", exact: true })
      .click();
    await page.getByRole("status").waitFor();
    assert.equal(state.shift, null);
    assert.deepEqual(errors, []);
    results.push({
      flow: "Shift open/redirect, amount validation, close confirmation and result",
      passed: true,
    });
    await context.close();
  }
  {
    const viewer = structuredClone(session);
    viewer.user.roles = ["COURIER"];
    viewer.user.permissions = ["COURIER_DELIVERY_VIEW"];
    const { context, page } = await setup(390, 844, viewer);
    await visit(page, "/courier");
    assert.equal(
      await page
        .getByRole("button", { name: "Yetkazildi", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("navigation", { name: "Ruxsat berilgan panellar" })
        .count(),
      0,
    );
    results.push({
      flow: "View-only courier cannot change statuses; single-role navigation stays compact",
      passed: true,
    });
    await context.close();
  }
  {
    const viewer = structuredClone(session);
    viewer.user.roles = ["KITCHEN"];
    viewer.user.permissions = ["KITCHEN_VIEW"];
    const { context, page } = await setup(390, 844, viewer);
    await visit(page, "/kitchen");
    assert.equal(
      await page
        .getByRole("button", { name: "Qabul qilish", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: /buyurtmani bekor qilish/ })
        .count(),
      0,
    );
    results.push({
      flow: "View-only kitchen has no status mutation actions",
      passed: true,
    });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
