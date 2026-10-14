import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:3118";
const user = {
  id: "qa-cashier",
  employeeId: "qa-employee",
  branchId: "qa-branch",
  email: "qa-cashier@example.test",
  roles: ["CASHIER"],
  permissions: [
    "SHIFT_VIEW_OWN",
    "ORDER_UPDATE",
    "PAYMENT_REFUND",
    "RECEIPT_PRINT",
  ],
};
const shift = {
  id: "qa-shift",
  shiftNumber: 12,
  status: "OPEN",
  openedAt: "2026-10-12T08:00:00.000Z",
  openingBalance: "0",
  expectedCash: "0",
  orderCount: 3,
  branch: { id: "qa-branch", name: "Test filial" },
  employee: { firstName: "QA", lastName: "Kassir" },
};
const order = {
  id: "qa-order",
  version: 1,
  shiftId: "qa-shift",
  orderNumber: "101",
  displayOrderNumber: "QA101",
  status: "SERVED",
  paymentStatus: "PAID",
  total: "10000",
  type: "DINE_IN",
  customerName: "Javohir QA",
  notes: "Iltimos, issiq holda tayyorlang",
  createdAt: "2026-10-12T08:30:00.000Z",
  items: [
    {
      id: "qa-item-1",
      productName: "Lavash",
      quantity: "1",
      totalPrice: "3000",
      status: "ACTIVE",
    },
    {
      id: "qa-item-2",
      productName: "Ichimlik",
      quantity: "1",
      totalPrice: "7000",
      status: "ACTIVE",
    },
  ],
  payments: [
    {
      id: "qa-payment",
      amount: "10000",
      status: "SUCCESS",
      method: { name: "Naqd", code: "CASH" },
      refunds: [],
    },
  ],
  receipts: [
    {
      id: "qa-receipt-101",
      documentType: "RECEIPT",
      receiptNumber: "QA-CHK-101",
    },
  ],
};
const orders = [
  order,
  {
    ...order,
    id: "qa-order-102",
    version: 2,
    orderNumber: "102",
    displayOrderNumber: "QA102",
    status: "CANCELLED",
    paymentStatus: "UNPAID",
    total: "5000",
    customerName: "Madina QA",
    items: [
      {
        id: "qa-item-102",
        productName: "Ichimlik",
        quantity: "1",
        totalPrice: "5000",
        status: "CANCELLED",
        cancellationReason: "Test bekor qilish",
      },
    ],
    payments: [],
    receipts: [],
  },
  {
    ...order,
    id: "qa-order-103",
    version: 3,
    orderNumber: "103",
    displayOrderNumber: "QA103",
    status: "COMPLETED",
    total: "20000",
    items: [
      {
        id: "qa-item-103",
        productName: "Oila lavash",
        quantity: "1",
        totalPrice: "20000",
        status: "ACTIVE",
      },
    ],
    receipts: [],
  },
];
const session = {
  user,
  tokens: {
    accessToken: "qa",
    refreshToken: "qa",
    tokenType: "Bearer",
  },
};

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const width of [375, 1280]) {
    for (const item of order.items) item.status = "ACTIVE";
    order.payments[0].refunds = [];
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      (value) =>
        localStorage.setItem("mazetto.auth.session", JSON.stringify(value)),
      session,
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const cancelRequests = [];
    const cancelIdempotencyKeys = [];
    const reprintRequests = [];
    const orderListRequests = [];
    await page.route("**/api/v1/**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const path = requestUrl.pathname.replace("/api/v1", "");
      let data = [];
      if (
        route.request().method() === "POST" &&
        path.endsWith("/actions/cancel")
      ) {
        cancelRequests.push(route.request().postDataJSON());
        cancelIdempotencyKeys.push(
          route.request().headers()["idempotency-key"],
        );
        const [, orderId, itemId] =
          path.match(/^\/orders\/([^/]+)\/items\/([^/]+)\/actions\/cancel$/) ??
          [];
        const targetOrder = orders.find((row) => row.id === orderId);
        const targetItem = targetOrder?.items.find(
          (item) => item.id === itemId,
        );
        if (targetItem) targetItem.status = "CANCELLED";
        if (targetOrder && targetItem && targetOrder.payments?.length) {
          const payment = targetOrder.payments[0];
          payment.refunds ??= [];
          payment.refunds.push({
            id: "qa-refund-1",
            orderItemId: itemId,
            amount: targetItem.totalPrice,
            reason: "CASHIER_ITEM_CANCELLED",
            createdAt: "2026-10-12T08:45:00.000Z",
          });
        }
      } else if (
        route.request().method() === "POST" &&
        /^\/receipts\/[^/]+\/reprint$/.test(path)
      ) {
        reprintRequests.push(path);
      }
      if (path === "/auth/me") data = user;
      else if (path === "/cash-register/shifts") data = [shift];
      else if (path.startsWith("/cash-register/shift/qa-shift/orders")) {
        const search =
          requestUrl.searchParams.get("search")?.toLowerCase() ?? "";
        const status = requestUrl.searchParams.get("status") ?? "";
        const sort = requestUrl.searchParams.get("sort") ?? "newest";
        orderListRequests.push({ search, status, sort });
        data = orders.filter((row) => {
          const matchesStatus = !status || row.status === status;
          const haystack = [
            row.displayOrderNumber,
            row.orderNumber,
            row.customerName,
            ...row.items.map((item) => item.productName),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return matchesStatus && (!search || haystack.includes(search));
        });
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: route.request().method() === "POST" ? { queued: true } : data,
        }),
      });
    });

    await page.goto(base + "/pos/history", { waitUntil: "domcontentloaded" });
    const orderButton = page.getByRole("button", { name: /QA101/ });
    await orderButton.waitFor();
    await page.getByRole("button", { name: /QA102/ }).waitFor();
    await page.getByRole("button", { name: /QA103/ }).waitFor();
    await orderButton.click();
    await page.getByRole("heading", { name: "Buyurtma #QA101" }).waitFor();
    await page.getByText("Iltimos, issiq holda tayyorlang").waitFor();
    await page.getByText("To'lovlar").waitFor();
    const reprintRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname.endsWith(
          "/receipts/qa-receipt-101/reprint",
        ),
    );
    await page
      .getByRole("button", { name: /Chekni qayta chiqarish · QA-CHK-101/ })
      .click();
    assert.equal((await reprintRequest).method(), "POST");
    assert.deepEqual(reprintRequests, ["/receipts/qa-receipt-101/reprint"]);
    await page
      .getByText("Chek qayta chop etish navbatiga qo'shildi.")
      .waitFor();

    await page
      .getByRole("button", { name: "Lavash mahsulotini bekor qilish" })
      .click();
    const reason = page.getByLabel("Bekor qilish sababi");
    await reason.fill("Oldingi sabab");
    await page.getByRole("button", { name: "Ortga", exact: true }).click();
    await page
      .getByRole("button", { name: "Ichimlik mahsulotini bekor qilish" })
      .click();
    assert.equal(
      await reason.inputValue(),
      "",
      "new cancellation starts blank",
    );
    const confirmCancel = page.getByRole("button", {
      name: "Bekor qilishni tasdiqlash",
    });
    assert.equal(
      await confirmCancel.isEnabled(),
      true,
      "blank reason does not block cancellation",
    );
    await confirmCancel.click();
    await page
      .getByText("Mahsulot bekor qilindi va buyurtma yangilandi.")
      .waitFor();
    assert.equal(cancelRequests.length, 1);
    assert.equal(cancelRequests[0].reasonCode, "CASHIER_ITEM_CANCELLED");
    assert.equal(
      cancelRequests[0].reason,
      undefined,
      "blank reason is omitted from request",
    );
    assert.equal(cancelRequests[0].shiftId, "qa-shift");
    assert.equal(cancelRequests[0].expectedVersion, 1);
    assert.ok(
      cancelIdempotencyKeys[0],
      "cancellation sends an idempotency key",
    );

    await page
      .getByRole("heading", { name: "Buyurtma #QA101" })
      .waitFor({ state: "detached" });
    const search = page.getByRole("textbox", { name: "Buyurtma qidirish" });
    const searchRequest = page.waitForRequest(
      (request) =>
        new URL(request.url()).searchParams.get("search") === "QA102",
    );
    await search.fill("QA102");
    await page.getByRole("button", { name: "Izlash", exact: true }).click();
    await searchRequest;
    await page.getByRole("button", { name: /QA102/ }).waitFor();
    assert.equal(await page.getByRole("button", { name: /QA101/ }).count(), 0);

    const filterRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.searchParams.get("search") === "QA102" &&
        url.searchParams.get("status") === "CANCELLED"
      );
    });
    await page
      .getByRole("combobox", { name: "Buyurtma holati" })
      .selectOption("CANCELLED");
    await filterRequest;
    await page.getByRole("button", { name: /QA102/ }).waitFor();
    assert.equal(await page.getByRole("button", { name: /QA102/ }).count(), 1);
    await page.getByRole("button", { name: /QA102/ }).click();
    await page.getByRole("heading", { name: "Buyurtma #QA102" }).waitFor();
    await page.getByText("Bekor sababi: Test bekor qilish").waitFor();
    await page.getByRole("button", { name: "Yopish" }).click();

    const clearSearchRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.searchParams.get("search") === null &&
        url.searchParams.get("status") === "CANCELLED"
      );
    });
    await search.fill("");
    await page.getByRole("button", { name: "Izlash", exact: true }).click();
    await clearSearchRequest;
    const clearFilterRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.searchParams.get("search") === null &&
        url.searchParams.get("status") === null
      );
    });
    await page
      .getByRole("combobox", { name: "Buyurtma holati" })
      .selectOption("");
    await clearFilterRequest;
    await page.getByRole("button", { name: /QA101/ }).waitFor();
    await page.getByRole("button", { name: /QA103/ }).waitFor();

    const sortRequest = page.waitForRequest(
      (request) =>
        new URL(request.url()).searchParams.get("sort") === "amount-low",
    );
    await page
      .getByRole("combobox", { name: "Tartiblash" })
      .selectOption("amount-low");
    await sortRequest;
    const sortedButtons = await page
      .getByRole("button", { name: /QA\d+/ })
      .allTextContents();
    assert.ok(
      sortedButtons[0].includes("QA101"),
      `lowest completed-order amount first: ${sortedButtons.join(" | ")}`,
    );
    assert.ok(
      sortedButtons[1].includes("QA103"),
      `higher completed-order amount second: ${sortedButtons.join(" | ")}`,
    );
    assert.ok(orderListRequests.some((request) => request.search === "qa102"));
    assert.ok(
      orderListRequests.some((request) => request.status === "CANCELLED"),
    );
    assert.ok(
      orderListRequests.some((request) => request.sort === "amount-low"),
    );
    assert.deepEqual(errors, []);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "history must not overflow horizontally",
    );
    await context.close();
  }
  console.log(
    "PASS: history search, status filter, amount sort, order details, cash-item cancellation and receipt reprint at 375px and 1280px",
  );
} finally {
  await browser.close();
}
