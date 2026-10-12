import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DesktopGateway } from "../src/gateway.js";
import { DesktopPrintWorker } from "../src/print-worker.js";
import { DesktopStore } from "../src/store.js";
function cachePosCatalog(
  store: DesktopStore,
  authorization: string,
  sellingPrice: number,
  products: Array<Record<string, unknown>> = [
    {
      id: "product-1",
      name: "Lavash",
      sellingPrice,
      printerRouting: "KITCHEN",
      variants: [],
      modifiers: [],
    },
  ],
): void {
  const url = "https://api.example.test/api/v1/pos/catalog";
  const authScope = DesktopStore.authScope(authorization);
  store.putCachedResponse({
    cacheKey: DesktopStore.cacheKey(url, authScope),
    requestUrl: url,
    authScope,
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      success: true,
      data: {
        branchId: "branch-1",
        paymentMethods: [{ code: "CASH", name: "Naqd", active: true }],
        products,
        tables: [{ id: "table-1", name: "1-stol", isActive: true }],
      },
    }),
    cachedAt: new Date().toISOString(),
  });
}


test("gateway serves the last successful JSON snapshot when upstream is offline", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  store.setSetting("device_auth_token", "device-secret");
  let receivedDeviceId: string | undefined;
  let receivedDeviceToken: string | undefined;
  const upstream = createServer((_request, response) => {
    receivedDeviceId = _request.headers["x-mazetto-device-id"] as
      | string
      | undefined;
    receivedDeviceToken = _request.headers["x-mazetto-device-token"] as
      | string
      | undefined;
    response.writeHead(200, {
      "Content-Type": "application/json",
      Connection: "close",
    });
    response.end('{"success":true,"data":[{"id":"branch-1"}]}');
  });
  upstream.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => upstream.once("listening", resolve));
  const address = upstream.address();
  assert.ok(address && typeof address !== "string");

  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: `http://127.0.0.1:${address.port}/api/v1`,
    store,
    getDeviceToken: () => "device-secret",
  });

  try {
    const gatewayPort = await gateway.start();
    const url = `http://127.0.0.1:${gatewayPort}/api/v1/branches`;
    const first = await fetch(url, {
      headers: { Authorization: "Bearer test" },
    });
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("x-mazetto-desktop"), "online");
    assert.deepEqual(await first.json(), {
      success: true,
      data: [{ id: "branch-1" }],
    });
    assert.equal(receivedDeviceId, store.deviceId());
    assert.equal(receivedDeviceToken, "device-secret");
    assert.equal(store.summary().cachedResponses, 1);

    upstream.close();
    await new Promise<void>((resolve) => upstream.once("close", resolve));

    const cached = await fetch(url, {
      headers: { Authorization: "Bearer test" },
    });
    assert.equal(cached.status, 200);
    assert.equal(cached.headers.get("x-mazetto-desktop"), "offline-cache");
    assert.deepEqual(await cached.json(), {
      success: true,
      data: [{ id: "branch-1" }],
    });
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway serves cached reads and marks itself offline on an upstream 503", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  let apiStatus = 200;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) => {
      if (String(input).endsWith("/health")) return jsonResponse({ ok: true });
      return apiStatus === 200
        ? jsonResponse({ success: true, data: [{ id: "branch-1" }] })
        : jsonResponse(
            { success: false, error: { message: "Service unavailable" } },
            apiStatus,
          );
    },
  });

  try {
    const port = await gateway.start();
    const url = `http://127.0.0.1:${port}/api/v1/branches`;
    const headers = {
      Authorization: desktopJwt("cashier-http-503", "branch-1"),
    };
    const online = await fetch(url, { headers });
    assert.equal(online.status, 200);
    assert.equal(store.summary().cachedResponses, 1);

    apiStatus = 503;
    const cached = await fetch(url, { headers });
    assert.equal(cached.status, 200);
    assert.equal(cached.headers.get("x-mazetto-desktop"), "offline-cache");
    assert.deepEqual(await cached.json(), {
      success: true,
      data: [{ id: "branch-1" }],
    });
    assert.equal(gateway.status().mode, "offline");
    assert.match(gateway.status().lastError ?? "", /503/);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway refuses an offline sale when its branch catalog is not cached", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) =>
      String(input).endsWith("/health")
        ? jsonResponse({ ok: true })
        : jsonResponse(
            { success: false, error: { message: "Gateway unavailable" } },
            503,
          ),
  });

  try {
    const port = await gateway.start();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/pos/orders`, {
      method: "POST",
      headers: {
        Authorization: desktopJwt("cashier-http-sale", "branch-1"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotencyKey: "http-outage-sale-1",
        items: [],
        payments: [{ paymentMethodCode: "CASH", amount: 12_000 }],
      }),
    });

    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "OFFLINE_POS_ORDER_UNSAFE");
    assert.equal(store.summary().pendingCommands, 0);
    assert.equal(store.summary().pendingPrintJobs, 0);
    assert.equal(gateway.status().mode, "offline");
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline mode refuses to queue sensitive staff actions even with idempotency keys", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-sensitive-offline-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  let upstreamOnline = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async () => {
      if (!upstreamOnline) throw new Error("network unavailable");
      return jsonResponse({ ok: true });
    },
  });

  const blockedActions = [
    "/api/v1/payments/payment-1/refund",
    "/api/v1/cash-register/transfers/transfer-1/accept",
    "/api/v1/courier/orders/order-1/assign",
    "/api/v1/shifts/shift-1/force-close",
    "/api/v1/receipts/receipt-1/reprint",
    "/api/v1/staff",
  ];

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    upstreamOnline = false;

    for (const [index, pathname] of blockedActions.entries()) {
      const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
        method: "POST",
        headers: {
          Authorization: desktopJwt("cashier-sensitive-offline", "branch-1"),
          "Content-Type": "application/json",
          "Idempotency-Key": `sensitive-offline-${index}`,
        },
        body: JSON.stringify({
          idempotencyKey: `sensitive-offline-${index}`,
          amount: 1_000,
        }),
      });

      assert.equal(response.status, 503, pathname);
      assert.equal(
        (await response.json()).error.code,
        "DESKTOP_OFFLINE",
        pathname,
      );
    }

    assert.equal(store.summary().pendingCommands, 0);
    assert.equal(store.summary().sendingCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway does not queue an ambiguous upstream-unavailable write without idempotency", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) =>
      String(input).endsWith("/health")
        ? jsonResponse({ ok: true })
        : jsonResponse(
            { success: false, error: { message: "Gateway unavailable" } },
            503,
          ),
  });

  try {
    const port = await gateway.start();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/pos/orders`, {
      method: "POST",
      headers: {
        Authorization: desktopJwt("cashier-ambiguous", "branch-1"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [],
        payments: [{ paymentMethodCode: "CASH", amount: 12_000 }],
      }),
    });

    assert.equal(response.status, 503);
    assert.equal(
      response.headers.get("x-mazetto-desktop"),
      "offline-unavailable",
    );
    assert.equal(store.summary().pendingCommands, 0);
    assert.equal(gateway.status().mode, "offline");
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway stop waits for a durable mutation sync before the store closes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-1", "branch-1");
  const authScope = DesktopStore.mutationScope(authorization);
  let beginPost: () => void = () => undefined;
  let releasePost: () => void = () => undefined;
  const postStarted = new Promise<void>((resolve) => {
    beginPost = resolve;
  });
  const postGate = new Promise<void>((resolve) => {
    releasePost = resolve;
  });
  store.enqueueMutation({
    idempotencyKey: "shutdown-safe-shift",
    commandType: "shift.open",
    aggregateType: "shifts",
    actorId: "cashier-1",
    branchId: "branch-1",
    authScope,
    payload: {
      commandType: "shift.open",
      queuedEmployeeId: null,
      method: "POST",
      pathname: "/api/v1/shifts/open",
      targetUrl: "https://api.example.test/api/v1/shifts/open",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "shutdown-safe-shift",
      },
      body: JSON.stringify({ branchId: "branch-1" }),
    },
  });
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (url.endsWith("/shifts/open")) {
        beginPost();
        await postGate;
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    const read = await fetch(`http://127.0.0.1:${port}/api/v1/branches`, {
      headers: { Authorization: authorization },
    });
    assert.equal(read.status, 200);
    await postStarted;

    let stopped = false;
    const stopping = gateway.stop().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(stopped, false);

    releasePost();
    await stopping;
    assert.equal(store.listOutbox().length, 0);
  } finally {
    releasePost();
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway queues POS sales offline and flushes them after reconnect", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-1", "branch-1");
  const sent: { url: string; idempotencyKey: string | null; body: string }[] =
    [];
  let online = true;
  const bootstrapSnapshot = {
    success: true,
    data: {
      schemaVersion: 2,
      branchId: "branch-1",
      branch: { id: "branch-1", name: "Sergeli filiali" },
      catalog: {
        branchId: "branch-1",
        orderDisplayNumberStart: 1,
        paymentMethods: [{ code: "CASH", name: "Naqd", active: true }],
        products: [
          {
            id: "product-1",
            name: "Lavash",
            sellingPrice: 20_000,
            variants: [
              { id: "variant-1", name: "Katta", sellingPrice: 25_000 },
            ],
            modifiers: [],
          },
        ],
        tables: [{ id: "table-1", name: "1-stol", code: "T1" }],
      },
    },
  };
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input, init) => {
      if (!online) {
        throw new Error("offline");
      }

      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }

      if (init?.method === "POST") {
        sent.push({
          url,
          idempotencyKey: new Headers(init.headers).get("idempotency-key"),
          body: String(init.body ?? ""),
        });
        return jsonResponse({ success: true, data: { ok: true } });
      }

      if (url.endsWith("/realtime/bootstrap")) {
        return jsonResponse(bootstrapSnapshot);
      }

      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const gatewayPort = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const bootstrap = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/realtime/bootstrap`,
      { headers: { Authorization: authorization } },
    );
    assert.equal(bootstrap.status, 200);
    online = false;

    const sale = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/pos/orders`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: "sale-key-1",
          type: "DINE_IN",
          tableId: "table-1",
          items: [
            {
              productId: "product-1",
              variantId: "variant-1",
              quantity: 1,
            },
          ],
          payments: [{ paymentMethodCode: "CASH", amount: 25_000 }],
        }),
      },
    );
    assert.equal(sale.status, 202);
    assert.equal(sale.headers.get("x-mazetto-desktop"), "offline-queued");
    assert.equal(store.summary().pendingCommands, 1);
    assert.equal(store.summary().pendingPrintJobs, 2);
    const saleData = (await sale.json()).data;
    const replay = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/pos/orders`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: "sale-key-1",
          type: "DINE_IN",
          tableId: "table-1",
          items: [
            {
              productId: "product-1",
              variantId: "variant-1",
              quantity: 1,
            },
          ],
          payments: [{ paymentMethodCode: "CASH", amount: 25_000 }],
        }),
      },
    );
    assert.equal(replay.status, 202);
    const replayData = (await replay.json()).data;
    assert.equal(replayData.order.id, saleData.order.id);
    assert.equal(replayData.order.orderNumber, saleData.order.orderNumber);
    assert.equal(store.summary().pendingCommands, 1);
    assert.equal(store.summary().pendingPrintJobs, 2);
    assert.match(saleData.order.orderNumber, /^POS-\d{8}-\d{6}-[A-F0-9]{8}$/);
    assert.equal(saleData.order.displayOrderNumber, 1);
    const outboxCommand = store.listOutbox()[0];
    assert.ok(outboxCommand);
    const queuedPayload = JSON.parse(
      store.getOutboxCommand(outboxCommand.id)?.payloadJson ?? "{}",
    ) as {
      offlineOrderSnapshot?: {
        items?: Array<{ productName?: string; variantName?: string }>;
        table?: { id?: string };
      };
    };
    assert.equal(
      queuedPayload.offlineOrderSnapshot?.items?.[0]?.productName,
      "Lavash",
    );
    assert.equal(
      queuedPayload.offlineOrderSnapshot?.items?.[0]?.variantName,
      "Katta",
    );
    assert.equal(queuedPayload.offlineOrderSnapshot?.table?.id, "table-1");

    const hallOrder = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/pos/orders`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: "hall-key-1",
          type: "DINE_IN",
          tableId: "table-1",
          payLater: true,
          offlineEstimatedTotal: 20_000,
          items: [{ productId: "product-1", quantity: 1 }],
        }),
      },
    );
    assert.equal(hallOrder.status, 202);
    const hallData = (await hallOrder.json()).data;
    assert.equal(hallData.order.paymentStatus, "PENDING");
    assert.equal(hallData.order.total, "20000");
    assert.deepEqual(hallData.payment.methods, []);
    assert.equal(store.summary().pendingCommands, 2);
    assert.equal(store.summary().pendingPrintJobs, 3);
    assert.equal(
      store.listLocalPrintJobs().filter((job) => job.documentType === "RECEIPT")
        .length,
      1,
    );
    const localReceiptJob = store.claimLocalPrintJob(["RECEIPT"]);
    assert.ok(localReceiptJob);
    const localReceipt = JSON.parse(localReceiptJob.payloadJson) as {
      branchName: string;
      orderType: string;
      items: Array<{ total?: string }>;
    };
    assert.equal(localReceipt.branchName, "Sergeli filiali");
    assert.equal(localReceipt.orderType, "Zal");
    assert.equal(localReceipt.items[0]?.total, "25000.00");
    const attemptId = store.markLocalPrintJobPrinting(localReceiptJob.id);
    assert.ok(attemptId);
    store.completeLocalPrintJob(localReceiptJob.id, attemptId);

    online = true;
    const onlineRequest = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/branches`,
      { headers: { Authorization: authorization } },
    );
    assert.equal(onlineRequest.status, 503);
    await waitFor(() => gateway.status().mode === "online");
    const recoveredRequest = await fetch(
      "http://127.0.0.1:" + gatewayPort + "/api/v1/branches",
      { headers: { Authorization: authorization } },
    );
    assert.equal(recoveredRequest.status, 200);

    await waitFor(
      () =>
        store.summary().pendingCommands === 0 &&
        store.summary().sendingCommands === 0,
    );
    assert.equal(sent.length, 2);
    assert.equal(sent[0]?.url, "https://api.example.test/api/v1/pos/orders");
    assert.equal(sent[0]?.idempotencyKey, "sale-key-1");
    assert.match(sent[0]?.body ?? "", /sale-key-1/);
    assert.match(sent[1]?.body ?? "", /"payLater":true/);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline POS mutation is not replayed under a different employee", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const originalAuthorization = desktopJwt("shared-cashier", "branch-1", {
    employeeId: "employee-1",
  });
  const currentAuthorization = desktopJwt("shared-cashier", "branch-1", {
    employeeId: "employee-2",
  });
  store.enqueueMutation({
    idempotencyKey: "employee-bound-sale",
    commandType: "pos.order.create",
    aggregateType: "orders",
    aggregateId: "local-order-1",
    actorId: "shared-cashier",
    branchId: "branch-1",
    authScope: DesktopStore.mutationScope(originalAuthorization),
    payload: {
      queuedEmployeeId: "employee-1",
      commandType: "pos.order.create",
      method: "POST",
      pathname: "/api/v1/pos/orders",
      targetUrl: "https://api.example.test/api/v1/pos/orders",
      headers: { "idempotency-key": "employee-bound-sale" },
      body: JSON.stringify({ idempotencyKey: "employee-bound-sale" }),
    },
  });
  const requests: string[] = [];
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) => {
      const pathname = new URL(String(input)).pathname;
      requests.push(pathname);
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/branches`, {
      headers: { Authorization: currentAuthorization },
    });
    assert.equal(response.status, 200);
    await waitFor(() => store.summary().conflictCommands === 1);
    assert.equal(requests.includes("/api/v1/pos/orders"), false);
    assert.match(
      store.listOutbox()[0]?.lastError ?? "",
      /EMPLOYEE_CONTEXT_CHANGED/,
    );
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy offline POS mutation without employee identity is not replayed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("shared-cashier", "branch-1", {
    employeeId: "employee-1",
  });
  store.enqueueMutation({
    idempotencyKey: "legacy-unbound-sale",
    commandType: "pos.order.create",
    aggregateType: "orders",
    aggregateId: "local-order-legacy",
    actorId: "shared-cashier",
    branchId: "branch-1",
    authScope: DesktopStore.mutationScope(authorization),
    payload: {
      commandType: "pos.order.create",
      method: "POST",
      pathname: "/api/v1/pos/orders",
      targetUrl: "https://api.example.test/api/v1/pos/orders",
      headers: { "idempotency-key": "legacy-unbound-sale" },
      body: JSON.stringify({ idempotencyKey: "legacy-unbound-sale" }),
    },
  });
  const requests: string[] = [];
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) => {
      const pathname = new URL(String(input)).pathname;
      requests.push(pathname);
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/branches`, {
      headers: { Authorization: authorization },
    });
    assert.equal(response.status, 200);
    await waitFor(() => store.summary().conflictCommands === 1);
    assert.equal(requests.includes("/api/v1/pos/orders"), false);
    assert.match(
      store.listOutbox()[0]?.lastError ?? "",
      /EMPLOYEE_CONTEXT_UNKNOWN/,
    );
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline POS order rejects a catalog cached for another branch", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-branch-cache", "branch-1");
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) => {
      if (!online) throw new Error("offline");
      const url = String(input);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (url.endsWith("/pos/catalog")) {
        return jsonResponse({
          success: true,
          data: {
            branchId: "branch-2",
            categories: [],
            products: [
              {
                id: "product-1",
                name: "Boshqa filial mahsuloti",
                variants: [{ id: "variant-1", name: "Chet filial varianti" }],
              },
            ],
            paymentMethods: [],
            tables: [],
          },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;
    const headers = { Authorization: authorization };
    const catalog = await fetch(baseUrl + "/pos/catalog", { headers });
    assert.equal(catalog.status, 200);

    online = false;
    const sale = await fetch(baseUrl + "/pos/orders", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "branch-cache-sale",
        type: "TAKEAWAY",
        items: [
          { productId: "product-1", variantId: "variant-1", quantity: 1 },
        ],
        payments: [{ paymentMethodCode: "CASH", amount: 25_000 }],
      }),
    });

    assert.equal(sale.status, 409);
    const result = await sale.json();
    assert.equal(result.error.code, "OFFLINE_POS_ORDER_UNSAFE");
    assert.match(result.error.message, /boshqa filialniki/);
    assert.equal(store.summary().pendingCommands, 0);
    assert.equal(store.summary().pendingPrintJobs, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline POS respects the cached cashier payment setting without blocking unpaid dine-in", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-offline-payment-setting-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-cash-disabled", "branch-1");
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 60_000,
    fetchImpl: async (input) => {
      if (!online) throw new Error("offline");
      const url = String(input);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (url.endsWith("/pos/catalog")) {
        return jsonResponse({
          success: true,
          data: {
            branchId: "branch-1",
            paymentMethods: [{ code: "CLICK", name: "Click", active: true }],
            products: [{ id: "product-1", name: "Lavash", sellingPrice: 10_000, variants: [], modifiers: [] }],
            tables: [],
          },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const baseUrl = "http://127.0.0.1:" + port + "/api/v1";
    const headers = { Authorization: authorization, "Content-Type": "application/json" };
    assert.equal((await fetch(baseUrl + "/pos/catalog", { headers })).status, 200);
    online = false;

    const paidSale = await fetch(baseUrl + "/pos/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        idempotencyKey: "cash-disabled-offline-sale",
        items: [{ productId: "product-1", quantity: 1 }],
        payments: [{ paymentMethodCode: "CASH", amount: 10_000 }],
      }),
    });
    assert.equal(paidSale.status, 409);
    assert.match((await paidSale.json()).error.message, /naqd to'lov yoqilmagan/);
    assert.equal(store.summary().pendingCommands, 0);
    assert.equal(store.summary().pendingPrintJobs, 0);

    const unpaidDineIn = await fetch(baseUrl + "/pos/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        idempotencyKey: "cash-disabled-unpaid-dine-in",
        type: "DINE_IN",
        payLater: true,
        items: [{ productId: "product-1", quantity: 1 }],
      }),
    });
    assert.equal(unpaidDineIn.status, 202);
    const data = (await unpaidDineIn.json()).data;
    assert.equal(data.order.paymentStatus, "PENDING");
    assert.equal(data.order.total, "10000");
    assert.deepEqual(data.payment.methods, []);
    assert.equal(store.summary().pendingCommands, 1);
    assert.equal(store.summary().pendingPrintJobs, 1);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline POS rejects invalid modifier selections and cash totals before queuing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-offline-pos-rules-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-offline-rules", "branch-1");
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 60_000,
    fetchImpl: async (input) => {
      if (!online) throw new Error("offline");
      const url = String(input);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (url.endsWith("/pos/catalog")) {
        return jsonResponse({
          success: true,
          data: {
            branchId: "branch-1",
            paymentMethods: [{ code: "CASH", name: "Naqd", active: true }],
            products: [
              {
                id: "product-1",
                name: "Lavash",
                sellingPrice: 10_000,
                variants: [],
                modifiers: [
                  {
                    isRequired: true,
                    minSelect: 1,
                    maxSelect: 1,
                    modifier: {
                      id: "modifier-1",
                      name: "Pishloq",
                      price: 2_000,
                    },
                  },
                ],
              },
            ],
            tables: [{ id: "table-1", name: "1-stol" }],
          },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;
    const headers = { Authorization: authorization };
    const cachedCatalog = await fetch(baseUrl + "/pos/catalog", { headers });
    assert.equal(cachedCatalog.status, 200);
    online = false;

    const validItem = {
      productId: "product-1",
      quantity: 1,
      modifiers: [{ modifierId: "modifier-1", quantity: 1 }],
    };
    const invalidOrders = [
      {
        idempotencyKey: "missing-required-modifier",
        items: [{ productId: "product-1", quantity: 1 }],
        payments: [{ paymentMethodCode: "CASH", amount: 10_000 }],
      },
      {
        idempotencyKey: "fractional-modifier-quantity",
        items: [{
          productId: "product-1",
          quantity: 1,
          modifiers: [{ modifierId: "modifier-1", quantity: 1.5 }],
        }],
        payments: [{ paymentMethodCode: "CASH", amount: 13_000 }],
      },
      {
        idempotencyKey: "duplicate-modifier",
        items: [{
          productId: "product-1",
          quantity: 1,
          modifiers: [
            { modifierId: "modifier-1", quantity: 1 },
            { modifierId: "modifier-1", quantity: 1 },
          ],
        }],
        payments: [{ paymentMethodCode: "CASH", amount: 14_000 }],
      },
      {
        idempotencyKey: "cash-total-mismatch",
        items: [validItem],
        payments: [{ paymentMethodCode: "CASH", amount: 11_999 }],
      },
      {
        idempotencyKey: "quantity-over-limit",
        items: [validItem, { productId: "product-1", quantity: 100 }],
        payments: [{ paymentMethodCode: "CASH", amount: 1_212_000 }],
      },
      {
        idempotencyKey: "invalid-delivery",
        type: "DELIVERY",
        items: [validItem],
        payments: [{ paymentMethodCode: "CASH", amount: 12_000 }],
      },
      {
        idempotencyKey: "unknown-table",
        type: "DINE_IN",
        tableId: "table-other-branch",
        items: [validItem],
        payments: [{ paymentMethodCode: "CASH", amount: 12_000 }],
      },
      {
        idempotencyKey: "dine-in-estimate-mismatch",
        type: "DINE_IN",
        tableId: "table-1",
        payLater: true,
        offlineEstimatedTotal: 13_000,
        items: [validItem],
      },
    ];

    for (const order of invalidOrders) {
      const response = await fetch(baseUrl + "/pos/orders", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      assert.equal(response.status, 409, order.idempotencyKey);
      assert.equal(
        (await response.json()).error.code,
        "OFFLINE_POS_ORDER_UNSAFE",
        order.idempotencyKey,
      );
      assert.equal(store.summary().pendingCommands, 0, order.idempotencyKey);
      assert.equal(store.summary().pendingPrintJobs, 0, order.idempotencyKey);
    }

    const headerOnlyKey = await fetch(baseUrl + "/pos/orders", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Idempotency-Key": "header-only-key",
      },
      body: JSON.stringify({
        items: [validItem],
        payments: [{ paymentMethodCode: "CASH", amount: 12_000 }],
      }),
    });
    assert.equal(headerOnlyKey.status, 409);
    assert.equal((await headerOnlyKey.json()).error.code, "OFFLINE_POS_ORDER_UNSAFE");

    const mismatchedKeys = await fetch(baseUrl + "/pos/orders", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Idempotency-Key": "header-key",
      },
      body: JSON.stringify({
        idempotencyKey: "body-key",
        items: [validItem],
        payments: [{ paymentMethodCode: "CASH", amount: 12_000 }],
      }),
    });
    assert.equal(mismatchedKeys.status, 409);
    assert.equal((await mismatchedKeys.json()).error.code, "OFFLINE_POS_ORDER_UNSAFE");
    assert.equal(store.summary().pendingCommands, 0);
    assert.equal(store.summary().pendingPrintJobs, 0);

    const accepted = await fetch(baseUrl + "/pos/orders", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "valid-offline-sale",
        items: [validItem],
        payments: [{ paymentMethodCode: "CASH", amount: 12_000 }],
      }),
    });
    assert.equal(accepted.status, 202);
    assert.equal(store.summary().pendingCommands, 1);
    assert.equal(store.summary().pendingPrintJobs, 2);
    const command = store.listOutbox()[0];
    assert.ok(command);
    const queued = JSON.parse(
      store.getOutboxCommand(command.id)?.payloadJson ?? "{}",
    ) as {
      offlineOrderSnapshot?: {
        total?: string;
        items?: Array<{ totalPrice?: string }>;
      };
    };
    assert.equal(queued.offlineOrderSnapshot?.total, "12000");
    assert.equal(
      queued.offlineOrderSnapshot?.items?.[0]?.totalPrice,
      "12000.00",
    );

    const unpaidTableOrder = await fetch(baseUrl + "/pos/orders", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "valid-offline-dine-in",
        type: "DINE_IN",
        tableId: "table-1",
        payLater: true,
        items: [validItem],
      }),
    });
    assert.equal(unpaidTableOrder.status, 202);
    const unpaidData = (await unpaidTableOrder.json()).data;
    assert.equal(unpaidData.order.paymentStatus, "PENDING");
    assert.equal(unpaidData.order.total, "12000");
    assert.deepEqual(unpaidData.payment.methods, []);
    assert.equal(store.summary().pendingCommands, 2);
    assert.equal(store.summary().pendingPrintJobs, 3);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway bounds slow upstream requests and queues the POS sale", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-timeout", "branch-1");
  cachePosCatalog(store, authorization, 25_000);
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    requestTimeoutMs: 35,
    fetchImpl: async (input, init) => {
      if (String(input).endsWith("/health")) {
        return jsonResponse({ ok: true });
      }
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        signal?.addEventListener(
          "abort",
          () => reject(signal.reason ?? new Error("timeout")),
          { once: true },
        );
      });
    },
  });

  try {
    const gatewayPort = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const startedAt = Date.now();
    const sale = await fetch(
      "http://127.0.0.1:" + gatewayPort + "/api/v1/pos/orders",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: "bounded-timeout-sale",
          items: [{ productId: "product-1", quantity: 1 }],
          payments: [{ paymentMethodCode: "CASH", amount: 25_000 }],
        }),
      },
    );
    assert.ok(Date.now() - startedAt < 1_000);
    assert.equal(sale.status, 202);
    assert.equal(store.summary().pendingCommands, 1);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway does not queue a write after an ambiguous network failure without a stable idempotency key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-ambiguous-network", "branch-1");
  const attempted: string[] = [];
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      attempted.push(url);
      throw new Error("connection reset after request write");
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/pos/orders`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [],
        payments: [{ paymentMethodCode: "CASH", amount: 12_000 }],
      }),
    });

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("x-mazetto-desktop"), null);
    assert.equal(attempted.length, 1);
    assert.equal(store.summary().pendingCommands, 0);
    assert.equal(store.summary().sendingCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway queues only cash payments while offline", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-offline-payment", "branch-1", {
    employeeId: "employee-offline-payment",
  });
  const cacheScope = DesktopStore.authScope(authorization);
  const cachedAt = new Date().toISOString();
  const cache = (url: string, data: unknown) => {
    store.putCachedResponse({
      cacheKey: DesktopStore.cacheKey(url, cacheScope),
      requestUrl: url,
      authScope: cacheScope,
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data }),
      cachedAt,
    });
  };
  cache("https://api.example.test/api/v1/cash-register/shift", {
    id: "shift-1",
    branchId: "branch-1",
    employeeId: "employee-offline-payment",
    status: "OPEN",
  });
  cache("https://api.example.test/api/v1/payments/methods", [
    { code: "CASH", name: "Naqd" },
  ]);
  cache("https://api.example.test/api/v1/orders/order-1", {
    id: "order-1",
    branchId: "branch-1",
    status: "NEW",
    type: "TAKEAWAY",
    paymentStatus: "PENDING",
    customerName: "Javohir",
    customerPhone: "+998901234567",
    deliveryAddress: "Sergeli",
    orderNumber: "ORDER-1",
    displayOrderNumber: "M-101",
    notes: "Eshik oldida qoldiring",
    total: "47000.00",
    items: [
      {
        id: "item-1",
        productName: "Lavash",
        variantName: "Katta",
        quantity: "1.000",
        totalPrice: "47000.00",
        status: "ACTIVE",
        notes: null,
        modifierSnapshot: [],
      },
    ],
    payments: [{ amount: "5000.00", status: "SUCCESS", methodCode: "CARD" }],
  });
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const endpoint =
      "http://127.0.0.1:" + gatewayPort + "/api/v1/payments/process";
    const headers = {
      Authorization: authorization,
      "Content-Type": "application/json",
    };
    const rejected = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        idempotencyKey: "offline-card-payment",
        payments: [{ paymentMethodCode: "UZCARD", amount: 42_000 }],
      }),
    });
    assert.equal(rejected.status, 503);
    assert.match((await rejected.json()).error.message, /faqat naqd/);
    assert.equal(store.summary().pendingCommands, 0);

    const queued = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        orderId: "order-1",
        shiftId: "shift-1",
        idempotencyKey: "offline-cash-payment",
        payments: [{ paymentMethodCode: "CASH", amount: 42_000 }],
      }),
    });
    assert.equal(queued.status, 202);
    assert.equal(store.summary().pendingCommands, 1);
    const printJob = store.claimLocalPrintJob(["RECEIPT"]);
    assert.ok(printJob);
    const receipt = JSON.parse(printJob.payloadJson) as Record<string, unknown>;
    assert.deepEqual(receipt.payments, [
      { method: "CARD", amount: "5000.00" },
      { method: "CASH", amount: "42000.00" },
    ]);
    assert.equal(receipt.total, "47000.00");
    assert.equal(receipt.customerName, "Javohir");
    assert.equal(receipt.customerPhone, "+998901234567");
    assert.equal(receipt.address, "Sergeli");
    assert.deepEqual(receipt.items, [
      {
        name: "Lavash",
        variant: "Katta",
        quantity: "1",
        total: "47000.00",
        notes: null,
        modifiers: [],
      },
    ]);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline cash payment fails closed without cached cashier tender settings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-offline-tender-cache-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-offline-no-tender-cache", "branch-1", {
    employeeId: "employee-offline-no-tender-cache",
  });
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });

  try {
    const port = await gateway.start();
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/payments/process`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: "order-1",
          shiftId: "shift-1",
          idempotencyKey: "offline-payment-without-tender-cache",
          payments: [{ paymentMethodCode: "CASH", amount: 12_000 }],
        }),
      },
    );

    assert.equal(response.status, 409);
    assert.match(
      (await response.json()).error.message,
      /to'lov sozlamalari qurilmada saqlanmagan/,
    );
    assert.equal(store.summary().pendingCommands, 0);
    assert.equal(store.claimLocalPrintJob(["RECEIPT"]), null);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline cash transactions block shift close until they sync", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-offline-cash-close-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-offline-expense-close", "branch-1");
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) => {
      if (!online) throw new Error("offline");
      const url = new URL(String(input));
      if (url.pathname.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }
      if (url.pathname === "/api/v1/cash-register/shift") {
        return jsonResponse({
          success: true,
          data: {
            id: "cash-shift-expense-1",
            branchId: "branch-1",
            status: "OPEN",
            openingBalance: "25000",
            currentBalance: "25000",
            expectedCash: "25000",
            cashTransactions: [],
          },
        });
      }
      return jsonResponse({ success: true, data: {} });
    },
  });

  try {
    const port = await gateway.start();
    const baseUrl = `http://127.0.0.1:${port}/api/v1/cash-register/shift`;
    const headers = {
      Authorization: authorization,
      "Content-Type": "application/json",
    };
    assert.equal(
      (await fetch(baseUrl, { headers: { Authorization: authorization } }))
        .status,
      200,
    );

    online = false;
    const unsupportedType = await fetch(
      `${baseUrl}/cash-shift-expense-1/transactions`,
      {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": "offline-forged-sale" },
        body: JSON.stringify({ type: "SALE", amount: 5000 }),
      },
    );
    assert.equal(unsupportedType.status, 409);
    assert.match(
      (await unsupportedType.json()).error.message,
      /Faqat kirim, xarajat yoki kassadan chiqarish/,
    );
    assert.equal(store.summary().pendingCommands, 0);

    const expense = await fetch(
      `${baseUrl}/cash-shift-expense-1/transactions`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Idempotency-Key": "offline-expense-before-close",
        },
        body: JSON.stringify({
          type: "EXPENSE",
          amount: 3_750,
          reason: "Xarid",
        }),
      },
    );
    assert.equal(expense.status, 202);
    assert.deepEqual(
      store
        .listActiveMutations(DesktopStore.mutationScope(authorization))
        .map((command) => command.commandType),
      ["cash.transaction.create"],
    );

    const close = await fetch(`${baseUrl}/cash-shift-expense-1/close`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "offline-close-after-expense" },
      body: JSON.stringify({ closingBalance: 21_250 }),
    });
    assert.equal(close.status, 409);
    assert.match(
      (await close.json()).error.message,
      /kassa amali hali sinxronlanmagan/,
    );
    assert.equal(store.summary().pendingCommands, 1);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline payment is projected as paid and blocks unsafe shift close", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-offline-payment-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt(
    "cashier-offline-payment-close",
    "branch-1",
    {
      employeeId: "employee-offline-payment-close",
    },
  );
  const ordersPath =
    "/orders?paymentStatus=PENDING&excludeStatus=CANCELLED&excludeType=DELIVERY&limit=50&offset=0";
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) => {
      if (!online) throw new Error("offline");
      const url = String(input);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (url.endsWith("/cash-register/shift")) {
        return jsonResponse({
          success: true,
          data: {
            id: "shift-offline-1",
            branchId: "branch-1",
            employeeId: "employee-offline-payment-close",
            branch: { id: "branch-1", name: "Sergeli filiali" },
            status: "OPEN",
            openingBalance: "0",
            currentBalance: "0",
            expectedCash: "0",
            cashSales: "0",
            orderCount: 0,
            cashTransactions: [],
            revenueRecords: [],
          },
        });
      }
      if (url.endsWith("/payments/methods")) {
        return jsonResponse({
          success: true,
          data: [{ code: "CASH", name: "Naqd" }],
        });
      }
      if (url.includes("/orders?")) {
        return jsonResponse({
          success: true,
          data: [
            {
              id: "order-offline-1",
              orderNumber: "WEB101",
              displayOrderNumber: "WEB101",
              source: "WEB",
              type: "TAKEAWAY",
              status: "READY",
              branchId: "branch-1",
              branch: { id: "branch-1", name: "Sergeli filiali" },
              total: "42000",
              paymentStatus: "PENDING",
              payments: [],
              items: [
                {
                  id: "item-offline-1",
                  status: "ACTIVE",
                  productName: "Katta lavash",
                  quantity: "1",
                  totalPrice: "42000.00",
                },
              ],
            },
            {
              id: "order-other-branch",
              orderNumber: "WEB102",
              source: "WEB",
              type: "TAKEAWAY",
              status: "READY",
              branchId: "branch-2",
              branch: { id: "branch-2", name: "Boshqa filial" },
              total: "42000",
              paymentStatus: "PENDING",
              payments: [],
              items: [
                {
                  id: "item-offline-2",
                  status: "ACTIVE",
                  productName: "Katta lavash",
                  quantity: "1",
                  totalPrice: "42000.00",
                },
              ],
            },
          ],
        });
      }
      return jsonResponse({ success: true, data: {} });
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const baseUrl = `http://127.0.0.1:${gatewayPort}/api/v1`;
    const headers = { Authorization: authorization };
    assert.equal(
      (await fetch(`${baseUrl}/cash-register/shift`, { headers })).status,
      200,
    );
    assert.equal(
      (await fetch(`${baseUrl}${ordersPath}`, { headers })).status,
      200,
    );
    assert.equal(
      (await fetch(`${baseUrl}/payments/methods`, { headers })).status,
      200,
    );

    const otherCashierAuthorization = desktopJwt(
      "cashier-other-employee",
      "branch-1",
      { employeeId: "employee-other-cashier" },
    );
    const otherCashierHeaders = {
      Authorization: otherCashierAuthorization,
    };
    assert.equal(
      (
        await fetch(`${baseUrl}/cash-register/shift`, {
          headers: otherCashierHeaders,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}${ordersPath}`, {
          headers: otherCashierHeaders,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/payments/methods`, {
          headers: otherCashierHeaders,
        })
      ).status,
      200,
    );

    const cacheScope = DesktopStore.authScope(authorization);
    const cachedShift = store.getLatestCachedResponse(
      cacheScope,
      "/api/v1/cash-register/shift",
    );
    const cachedOrders = store.getLatestCachedResponse(
      cacheScope,
      "/api/v1/orders",
    );
    const cachedPaymentMethods = store.getLatestCachedResponse(
      cacheScope,
      "/api/v1/payments/methods",
    );
    assert.ok(cachedShift);
    assert.ok(cachedOrders);
    assert.ok(cachedPaymentMethods);
    const staleAt = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();

    online = false;
    store.putCachedResponse({ ...cachedShift, cachedAt: staleAt });
    const staleShiftPayment = await fetch(`${baseUrl}/payments/process`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "order-offline-1",
        shiftId: "shift-offline-1",
        idempotencyKey: "offline-payment-stale-shift",
        payments: [{ paymentMethodCode: "CASH", amount: "42000" }],
      }),
    });
    assert.equal(staleShiftPayment.status, 409);
    assert.match(
      (await staleShiftPayment.json()).error.message,
      /keshi eskirgan/,
    );
    const staleShiftCashOut = await fetch(
      `${baseUrl}/cash-register/shift/shift-offline-1/transactions`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Idempotency-Key": "offline-cash-stale-shift",
        },
        body: JSON.stringify({ type: "EXPENSE", amount: 100 }),
      },
    );
    assert.equal(staleShiftCashOut.status, 409);
    assert.match(
      (await staleShiftCashOut.json()).error.message,
      /Kassa smenasi keshi eskirgan/,
    );
    store.putCachedResponse({
      ...cachedShift,
      cachedAt: new Date().toISOString(),
    });

    store.putCachedResponse({ ...cachedOrders, cachedAt: staleAt });
    const staleOrderPayment = await fetch(`${baseUrl}/payments/process`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "order-offline-1",
        shiftId: "shift-offline-1",
        idempotencyKey: "offline-payment-stale-order",
        payments: [{ paymentMethodCode: "CASH", amount: "42000" }],
      }),
    });
    assert.equal(staleOrderPayment.status, 409);
    assert.match(
      (await staleOrderPayment.json()).error.message,
      /keshi eskirgan/,
    );
    store.putCachedResponse({
      ...cachedOrders,
      cachedAt: new Date().toISOString(),
    });

    store.putCachedResponse({ ...cachedPaymentMethods, cachedAt: staleAt });
    const stalePaymentMethodsPayment = await fetch(
      `${baseUrl}/payments/process`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: "order-offline-1",
          shiftId: "shift-offline-1",
          idempotencyKey: "offline-payment-stale-method-settings",
          payments: [{ paymentMethodCode: "CASH", amount: "42000" }],
        }),
      },
    );
    assert.equal(stalePaymentMethodsPayment.status, 409);
    assert.match(
      (await stalePaymentMethodsPayment.json()).error.message,
      /to'lov sozlamalari keshi eskirgan/,
    );

    const disabledPaymentMethods = {
      ...cachedPaymentMethods,
      body: JSON.stringify({
        success: true,
        data: [{ code: "CLICK", name: "Click" }],
      }),
      cachedAt: new Date().toISOString(),
    };
    store.putCachedResponse(disabledPaymentMethods);
    const disabledCashPayment = await fetch(`${baseUrl}/payments/process`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "order-offline-1",
        shiftId: "shift-offline-1",
        idempotencyKey: "offline-payment-disabled-cash-method",
        payments: [{ paymentMethodCode: "CASH", amount: "42000" }],
      }),
    });
    assert.equal(disabledCashPayment.status, 409);
    assert.match(
      (await disabledCashPayment.json()).error.message,
      /Naqd to'lov usuli .* o'chirilgan/,
    );
    assert.equal(store.summary().pendingCommands, 0);
    store.putCachedResponse({
      ...cachedPaymentMethods,
      cachedAt: new Date().toISOString(),
    });

    const otherCashierPayment = await fetch(`${baseUrl}/payments/process`, {
      method: "POST",
      headers: {
        Authorization: otherCashierAuthorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: "order-offline-1",
        shiftId: "shift-offline-1",
        idempotencyKey: "offline-payment-other-employee",
        payments: [{ paymentMethodCode: "CASH", amount: "42000" }],
      }),
    });
    assert.equal(otherCashierPayment.status, 409);
    assert.match((await otherCashierPayment.json()).error.message, /xodim/);

    const wrongShiftPayment = await fetch(`${baseUrl}/payments/process`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "order-offline-1",
        shiftId: "shift-other-branch",
        idempotencyKey: "offline-payment-wrong-shift",
        payments: [{ paymentMethodCode: "CASH", amount: "42000" }],
      }),
    });
    assert.equal(wrongShiftPayment.status, 409);
    assert.match((await wrongShiftPayment.json()).error.message, /smena/);

    const wrongBranchPayment = await fetch(`${baseUrl}/payments/process`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "order-other-branch",
        shiftId: "shift-offline-1",
        idempotencyKey: "offline-payment-wrong-branch",
        payments: [{ paymentMethodCode: "CASH", amount: "42000" }],
      }),
    });
    assert.equal(wrongBranchPayment.status, 409);
    assert.match((await wrongBranchPayment.json()).error.message, /filial/);

    const wrongAmountPayment = await fetch(`${baseUrl}/payments/process`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "order-offline-1",
        shiftId: "shift-offline-1",
        idempotencyKey: "offline-payment-wrong-amount",
        payments: [{ paymentMethodCode: "CASH", amount: "42001" }],
      }),
    });
    assert.equal(wrongAmountPayment.status, 409);
    assert.match(
      (await wrongAmountPayment.json()).error.message,
      /aniq qolgan/,
    );
    assert.equal(store.summary().pendingCommands, 0);

    const paymentRequest = {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "order-offline-1",
        shiftId: "shift-offline-1",
        idempotencyKey: "offline-payment-close-1",
        payments: [{ paymentMethodCode: "CASH", amount: "42000" }],
      }),
    };
    const payment = await fetch(`${baseUrl}/payments/process`, paymentRequest);
    assert.equal(payment.status, 202);
    const paymentPayload = await payment.json();
    const replayPayment = await fetch(
      `${baseUrl}/payments/process`,
      paymentRequest,
    );
    assert.equal(replayPayment.status, 202, await replayPayment.clone().text());
    const replayPayload = await replayPayment.json();
    assert.equal(replayPayload.data.commandId, paymentPayload.data.commandId);
    assert.equal(store.summary().pendingCommands, 1);
    assert.equal(paymentPayload.data.offlineReceiptQueued, true);
    const receiptJob = store.claimLocalPrintJob(["RECEIPT"]);
    assert.ok(receiptJob);
    const receipt = JSON.parse(receiptJob.payloadJson) as {
      orderId: string;
      orderNumber: string;
      orderSource: string;
      orderType: string;
      total: string;
      items: Array<{ name: string }>;
      payments: Array<{ method: string; amount: string }>;
    };
    assert.equal(receipt.orderId, "order-offline-1");
    assert.equal(receipt.orderNumber, "WEB101");
    assert.equal(receipt.orderSource, "WEB");
    assert.equal(receipt.orderType, "Olib ketish");
    assert.equal(receipt.total, "42000.00");
    assert.equal(receipt.items[0]?.name, "Katta lavash");
    assert.deepEqual(receipt.payments, [
      { method: "CASH", amount: "42000.00" },
    ]);
    const receiptAttemptId = store.markLocalPrintJobPrinting(receiptJob.id);
    assert.ok(receiptAttemptId);
    store.completeLocalPrintJob(receiptJob.id, receiptAttemptId);

    assert.deepEqual(
      store
        .listActiveMutations(DesktopStore.mutationScope(authorization))
        .map((item) => item.commandType),
      ["payment.process"],
    );
    const pendingOrders = await fetch(`${baseUrl}${ordersPath}`, { headers });
    assert.equal(
      pendingOrders.headers.get("x-mazetto-desktop"),
      "offline-optimistic",
    );
    const pendingPayload = await pendingOrders.json();
    assert.equal(pendingPayload.data[0].paymentStatus, "PAID");
    assert.equal(pendingPayload.data[0].pendingSync, true);

    const pendingShift = await fetch(`${baseUrl}/cash-register/shift`, {
      headers,
    });
    assert.equal(
      pendingShift.headers.get("x-mazetto-desktop"),
      "offline-optimistic",
    );
    const pendingShiftPayload = await pendingShift.json();
    assert.equal(pendingShiftPayload.data.expectedCash, "42000");
    assert.equal(pendingShiftPayload.data.currentBalance, "42000");
    assert.equal(pendingShiftPayload.data.cashSales, "42000");
    assert.equal(pendingShiftPayload.data.orderCount, 1);
    assert.deepEqual(
      pendingShiftPayload.data.cashTransactions.map((transaction) => [
        transaction.type,
        transaction.amount,
        transaction.pendingSync,
      ]),
      [["SALE", "42000", true]],
    );
    const repeatedShift = await fetch(`${baseUrl}/cash-register/shift`, {
      headers,
    });
    const repeatedShiftPayload = await repeatedShift.json();
    assert.equal(repeatedShiftPayload.data.expectedCash, "42000");
    assert.equal(repeatedShiftPayload.data.cashSales, "42000");
    assert.equal(repeatedShiftPayload.data.orderCount, 1);

    const close = await fetch(
      `${baseUrl}/cash-register/shift/shift-offline-1/close`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Idempotency-Key": "offline-close-after-payment-1",
        },
        body: JSON.stringify({ closingBalance: 42_000 }),
      },
    );
    assert.equal(close.status, 409);
    assert.match((await close.json()).error.message, /hali sinxronlanmagan/);
    assert.equal(store.summary().pendingCommands, 1);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway flushes queued mutations from the reconnect health probe", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-2", "branch-1");
  const cacheScope = DesktopStore.authScope(authorization);
  const catalogUrl = "https://api.example.test/api/v1/pos/catalog";
  store.putCachedResponse({
    cacheKey: DesktopStore.cacheKey(catalogUrl, cacheScope),
    requestUrl: catalogUrl,
    authScope: cacheScope,
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      success: true,
      data: {
        branchId: "branch-1",
        paymentMethods: [{ code: "CASH", name: "Naqd", active: true }],
        products: [
          { id: "product-1", name: "Lavash", sellingPrice: 15_000, variants: [], modifiers: [] },
        ],
        tables: [],
      },
    }),
    cachedAt: new Date().toISOString(),
  });
  const sent: string[] = [];
  let online = false;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input, init) => {
      if (!online) {
        throw new Error("offline");
      }

      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }

      sent.push(`${init?.method ?? "GET"} ${url}`);
      return jsonResponse({ success: true, data: { ok: true } });
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const sale = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/pos/orders`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: "sale-key-probe",
          items: [{ productId: "product-1", quantity: 1 }],
          payments: [{ paymentMethodCode: "CASH", amount: 15_000 }],
        }),
      },
    );
    assert.equal(sale.status, 202);
    assert.equal(store.summary().pendingCommands, 1);

    online = true;
    await waitFor(
      () =>
        store.summary().pendingCommands === 0 &&
        store.summary().sendingCommands === 0,
      2_500,
    );
    assert.deepEqual(sent, ["POST https://api.example.test/api/v1/pos/orders"]);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway exposes and retries failed local printer jobs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-printer", "branch-1");
  store.enqueueLocalPrintJob({
    logicalKey: "local-order:RECEIPT",
    branchId: "branch-1",
    documentType: "RECEIPT",
    payload: { orderNumber: "OFF-101" },
  });
  let printJob = null;
  let retryAt = new Date();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    printJob = store.claimLocalPrintJob(["RECEIPT"], retryAt);
    assert.ok(printJob);
    store.failLocalPrintJob(printJob.id, "Printer offline", retryAt);
    if (attempt < 4) {
      retryAt = new Date(retryAt.getTime() + 5_000 * 2 ** attempt);
    }
  }
  assert.equal(store.summary().deadLetterPrintJobs, 1);

  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const base = "http://127.0.0.1:" + gatewayPort + "/desktop";
    const otherJobInput = {
      logicalKey: "other-branch-order:RECEIPT",
      branchId: "branch-2",
      documentType: "RECEIPT" as const,
      payload: { orderNumber: "OFF-202" },
    };
    store.enqueueLocalPrintJob(otherJobInput);
    const otherJob = store.listLocalPrintJobs(10, "branch-2")[0]!;
    let otherRetryAt = new Date();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const claimed = store.claimLocalPrintJob(["RECEIPT"], otherRetryAt);
      assert.equal(claimed?.id, otherJob.id);
      store.failLocalPrintJob(otherJob.id, "Printer offline", otherRetryAt);
      if (attempt < 4) {
        otherRetryAt = new Date(otherRetryAt.getTime() + 60_000);
      }
    }

    const listed = await fetch(base + "/outbox", {
      headers: { Authorization: authorization },
    });
    const queue = await listed.json();
    assert.equal(queue.data.printJobs[0].state, "dead_letter");
    assert.equal(queue.data.printJobs[0].lastError, "Printer offline");
    assert.equal(queue.data.printJobs.length, 1);

    const otherBranchRetry = await fetch(
      base + "/prints/" + otherJob.id + "/retry",
      { method: "POST", headers: { Authorization: authorization } },
    );
    assert.equal(otherBranchRetry.status, 409);

    const retried = await fetch(base + "/prints/" + printJob.id + "/retry", {
      method: "POST",
      headers: { Authorization: authorization },
    });
    assert.equal(retried.status, 200);
    const updated = await retried.json();
    assert.equal(updated.data.printJobs[0].state, "pending");
    assert.equal(updated.data.summary.pendingPrintJobs, 1);
    assert.equal(updated.data.summary.deadLetterPrintJobs, 1);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway fast-fails to local cache and outbox while offline, then replays once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-fast-offline", "branch-1");
  cachePosCatalog(store, authorization, 25_000);
  let online = true;
  let orderRequests = 0;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input) => {
      const url = String(input);
      if (!online) throw new Error("offline");
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (url.endsWith("/pos/orders")) {
        orderRequests += 1;
        return jsonResponse({ order: { id: "server-order-1" } });
      }
      if (url.endsWith("/orders")) return jsonResponse([]);
      return jsonResponse({ ok: true });
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const baseUrl = "http://127.0.0.1:" + gatewayPort + "/api/v1";
    const headers = { Authorization: authorization };
    const initial = await fetch(baseUrl + "/orders", { headers });
    assert.equal(initial.status, 200);

    online = false;
    const firstOfflineRead = await fetch(baseUrl + "/orders", { headers });
    assert.equal(firstOfflineRead.status, 200);
    await waitFor(() => gateway.status().mode === "offline");

    const requestsBeforeFastPath = orderRequests;
    const cachedRead = await fetch(baseUrl + "/orders", { headers });
    assert.equal(cachedRead.headers.get("x-mazetto-desktop"), "offline-cache");
    assert.equal(orderRequests, requestsBeforeFastPath);

    const queuedSale = await fetch(baseUrl + "/pos/orders", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "fast-offline-sale",
        items: [{ productId: "product-1", quantity: 1 }],
        payments: [{ paymentMethodCode: "CASH", amount: 25_000 }],
      }),
    });
    assert.equal(queuedSale.status, 202);
    assert.equal(orderRequests, requestsBeforeFastPath);
    assert.equal(store.summary().pendingCommands, 1);

    online = true;
    await waitFor(
      () =>
        store.summary().pendingCommands === 0 &&
        store.summary().sendingCommands === 0,
    );
    assert.equal(orderRequests, 1);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("independent offline terminals replay each cash sale once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-multi-terminal-"));
  let online = false;
  const replayedIdempotencyKeys: string[] = [];
  const terminals = ["terminal-a", "terminal-b"].map((terminalId) => {
    const store = new DesktopStore(join(directory, `${terminalId}.sqlite`));
    const gateway = new DesktopGateway({
      host: "127.0.0.1",
      port: 0,
      upstreamApiUrl: "https://api.example.test/api/v1",
      store,
      probeIntervalMs: 25,
      fetchImpl: async (input, init) => {
        const url = String(input);
        if (!online) throw new Error("offline");
        if (url.endsWith("/health")) return jsonResponse({ ok: true });
        if (url.endsWith("/pos/orders")) {
          const idempotencyKey = new Headers(init?.headers).get(
            "Idempotency-Key",
          );
          assert.ok(idempotencyKey);
          replayedIdempotencyKeys.push(idempotencyKey);
          return jsonResponse({ order: { id: `server-${idempotencyKey}` } });
        }
        return jsonResponse({ ok: true });
      },
    });
    return { terminalId, store, gateway };
  });

  const authorization = desktopJwt("cashier-multi-terminal", "branch-1");
  for (const { store } of terminals) {
    cachePosCatalog(store, authorization, 25_000);
  }
  assert.notEqual(
    terminals[0]?.store.deviceId(),
    terminals[1]?.store.deviceId(),
  );

  try {
    const ports = await Promise.all(
      terminals.map(({ gateway }) => gateway.start()),
    );
    const offlineSales = await Promise.all(
      terminals.map(({ terminalId }, index) => {
        const port = ports[index];
        assert.ok(port);
        return fetch(`http://127.0.0.1:${port}/api/v1/pos/orders`, {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
            "Idempotency-Key": `${terminalId}-sale-1`,
          },
          body: JSON.stringify({
            idempotencyKey: `${terminalId}-sale-1`,
            items: [{ productId: "product-1", quantity: 1 }],
            payments: [{ paymentMethodCode: "CASH", amount: 25_000 }],
          }),
        });
      }),
    );

    assert.deepEqual(
      offlineSales.map((response) => response.status),
      [202, 202],
    );
    assert.deepEqual(
      terminals.map(({ store }) => store.summary().pendingCommands),
      [1, 1],
    );

    online = true;
    await Promise.all(
      terminals.map(({ store }) =>
        waitFor(
          () =>
            store.summary().pendingCommands === 0 &&
            store.summary().sendingCommands === 0,
          2_500,
        ),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.deepEqual(replayedIdempotencyKeys.sort(), [
      "terminal-a-sale-1",
      "terminal-b-sale-1",
    ]);
    assert.equal(new Set(replayedIdempotencyKeys).size, 2);
  } finally {
    await Promise.all(terminals.map(({ gateway }) => gateway.stop()));
    for (const { store } of terminals) store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("offline sale and print jobs survive restart before one-time replay", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-offline-e2e-"));
  const storePath = join(directory, "test.sqlite");
  let store = new DesktopStore(storePath);
  const authorization = desktopJwt("cashier-offline-e2e", "branch-1");
  cachePosCatalog(store, authorization, 25_000, [
    {
      id: "product-1",
      name: "Lavash",
      sellingPrice: 25_000,
      printerRouting: "KITCHEN",
      variants: [],
      modifiers: [],
    },
    {
      id: "product-2",
      name: "Coca Cola",
      sellingPrice: 5_000,
      printerRouting: "RECEIPT",
      variants: [],
      modifiers: [],
    },
  ]);
  let online = false;
  let replayedSales = 0;
  const createGateway = (activeStore: DesktopStore) =>
    new DesktopGateway({
      host: "127.0.0.1",
      port: 0,
      upstreamApiUrl: "https://api.example.test/api/v1",
      store: activeStore,
      probeIntervalMs: 25,
      fetchImpl: async (input, init) => {
        const url = String(input);
        if (!online) throw new Error("offline");
        if (url.endsWith("/health")) return jsonResponse({ ok: true });
        if (url.endsWith("/pos/orders")) {
          replayedSales += 1;
          assert.equal(
            new Headers(init?.headers).get("Idempotency-Key"),
            "offline-e2e-sale",
          );
          return jsonResponse({ order: { id: "server-order-e2e" } });
        }
        return jsonResponse({ ok: true });
      },
    });
  let gateway = createGateway(store);
  const printed: Array<{
    documentType: string;
    content: Record<string, unknown>;
  }> = [];
  const localQueue = {
    claim: (types: string[]) => store.claimLocalPrintJob(types),
    markPrinting: (id: string) => store.markLocalPrintJobPrinting(id),
    complete: (id: string) => store.completeLocalPrintJob(id),
    fail: (id: string, error: string, ambiguous?: boolean) =>
      store.failLocalPrintJob(id, error, new Date(), ambiguous),
    wasPrinted: (id: string, type: string) =>
      store.wasLocalDocumentPrinted(id, type),
    wasTargetPrinted: (scope: "local" | "server", id: string, name: string) =>
      store.wasPrintTargetPrinted(scope, id, name),
    markTargetPrinted: (scope: "local" | "server", id: string, name: string) =>
      store.recordPrintTarget(scope, id, name, "printed"),
    markTargetAmbiguous: (
      scope: "local" | "server",
      id: string,
      name: string,
    ) => store.recordPrintTarget(scope, id, name, "ambiguous"),
  };

  try {
    const port = await gateway.start();
    const response = await fetch(
      "http://127.0.0.1:" + port + "/api/v1/pos/orders",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": "offline-e2e-sale",
        },
        body: JSON.stringify({
          idempotencyKey: "offline-e2e-sale",
          type: "TAKEAWAY",
          items: [
            { productId: "product-1", quantity: 1 },
            { productId: "product-2", quantity: 1 },
          ],
          payments: [{ paymentMethodCode: "CASH", amount: 30_000 }],
        }),
      },
    );
    assert.equal(response.status, 202);
    assert.equal(store.summary().pendingCommands, 1);
    assert.equal(store.summary().pendingPrintJobs, 2);
    const deviceId = store.deviceId();
    await gateway.stop();
    store.close();
    store = new DesktopStore(storePath);
    assert.equal(store.deviceId(), deviceId);
    assert.equal(store.summary().pendingCommands, 1);
    assert.equal(store.summary().pendingPrintJobs, 2);
    gateway = createGateway(store);
    const restartedPort = await gateway.start();
    const offlinePrinter = new DesktopPrintWorker({
      apiUrl: "https://api.example.test/api/v1",
      printerHost: null,
      agentId: "desktop-device-1",
      deviceId: store.deviceId(),
      systemPrinters: [
        { name: "Receipt", displayName: "Receipt", roles: ["RECEIPT"] },
        { name: "Kitchen", displayName: "Kitchen", roles: ["KITCHEN"] },
      ],
      printSystem: async (_name, receipt) => {
        printed.push({
          documentType: receipt.documentType ?? "unknown",
          content: receipt.content ?? {},
        });
      },
      localQueue,
    });
    await offlinePrinter.tick();
    assert.deepEqual(printed.map((entry) => entry.documentType).sort(), [
      "KITCHEN",
      "RECEIPT",
    ]);
    const salesReceipt = printed.find(
      (entry) => entry.documentType === "RECEIPT",
    )?.content;
    assert.equal(salesReceipt?.total, "30000.00");
    assert.deepEqual(
      (salesReceipt?.items as Array<{ name: string }>).map((item) => item.name),
      ["Lavash", "Coca Cola"],
    );
    assert.deepEqual(salesReceipt?.payments, [
      { method: "CASH", amount: "30000.00" },
    ]);
    const kitchenReceipt = printed.find(
      (entry) => entry.documentType === "KITCHEN",
    )?.content;
    assert.deepEqual(
      (kitchenReceipt?.items as Array<{ name: string }>).map((item) => item.name),
      ["Lavash"],
    );
    online = true;
    await waitFor(() => gateway.status().mode === "online", 2_500);
    const reconnectedRead = await fetch(
      `http://127.0.0.1:${restartedPort}/api/v1/orders`,
      { headers: { Authorization: authorization } },
    );
    assert.equal(reconnectedRead.status, 200);
    await waitFor(
      () =>
        store.summary().pendingCommands === 0 &&
        store.summary().sendingCommands === 0,
      2_500,
    );
    assert.equal(replayedSales, 1);
    assert.equal(
      store.wasLocalDocumentPrinted("server-order-e2e", "RECEIPT"),
      true,
    );
    let claimed = false;
    let completed = 0;
    const reconnectedPrinter = new DesktopPrintWorker({
      apiUrl: "https://api.example.test/api/v1",
      printerHost: null,
      agentId: "desktop-device-1",
      deviceId: store.deviceId(),
      systemPrinters: [
        { name: "Receipt", displayName: "Receipt", roles: ["RECEIPT"] },
      ],
      printSystem: async (_name, receipt) => {
        printed.push({
          documentType: receipt.documentType ?? "unknown",
          content: receipt.content ?? {},
        });
      },
      localQueue,
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith("/printers")) return jsonResponse([]);
        if (url.endsWith("/print-jobs/claim")) {
          if (claimed) return jsonResponse(null);
          claimed = true;
          return jsonResponse({
            id: "server-job-1",
            receiptId: "receipt-1",
            leaseToken: "lease-1",
            receipt: {
              receiptNumber: "R-1",
              documentType: "RECEIPT",
              orderId: "server-order-e2e",
            },
            payload: {
              documentType: "RECEIPT",
              orderNumber: "POS-1",
              items: [{ productName: "Item" }],
            },
          });
        }
        if (url.endsWith("/complete")) {
          completed += 1;
          return jsonResponse({ ok: true });
        }
        throw new Error("Unexpected printer request: " + url);
      },
    });
    reconnectedPrinter.setAuthorization(authorization);
    await reconnectedPrinter.tick();
    assert.equal(completed, 1);
    assert.equal(
      printed.filter((entry) => entry.documentType === "RECEIPT").length,
      1,
    );
    assert.equal(
      printed.filter((entry) => entry.documentType === "KITCHEN").length,
      1,
    );
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("queued mutations wait for refreshed auth after replay receives 401", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-auth-replay-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-expired-replay", "branch-1");
  cachePosCatalog(store, authorization, 12_000);
  const refreshedAuthorization = desktopJwt(
    "cashier-expired-replay",
    "branch-1",
    { iat: 2 },
  );
  let networkAvailable = false;
  const replayAuthorizations: string[] = [];
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (!networkAvailable) throw new Error("offline");
      const requestAuthorization = new Headers(init?.headers).get(
        "authorization",
      );
      if (url.endsWith("/pos/orders") && init?.method === "POST") {
        replayAuthorizations.push(requestAuthorization ?? "");
        if (requestAuthorization === authorization) {
          return jsonResponse(
            { success: false, error: { message: "Access token expired" } },
            401,
          );
        }
        return jsonResponse({ success: true, data: { id: "server-order-1" } });
      }
      return jsonResponse(
        { success: true, data: [] },
        requestAuthorization === authorization ? 401 : 200,
      );
    },
  });

  try {
    const port = await gateway.start();
    const baseUrl = "http://127.0.0.1:" + port + "/api/v1";
    const queued = await fetch(baseUrl + "/pos/orders", {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "Idempotency-Key": "expired-auth-offline-sale",
      },
      body: JSON.stringify({
        idempotencyKey: "expired-auth-offline-sale",
        items: [{ productId: "product-1", quantity: 1 }],
        payments: [{ paymentMethodCode: "CASH", amount: 12_000 }],
      }),
    });
    assert.equal(queued.status, 202);
    assert.equal(store.summary().pendingCommands, 1);

    networkAvailable = true;
    await waitFor(() => gateway.status().mode === "online", 4_000);
    const expiredSessionRead = await fetch(baseUrl + "/orders", {
      headers: { Authorization: authorization },
    });
    assert.equal(expiredSessionRead.status, 401);
    await waitFor(() => replayAuthorizations.length === 1);
    await waitFor(
      () =>
        store.listOutbox()[0]?.lastError ===
        "Kirish sessiyasini yangilash kutilmoqda",
    );
    assert.equal(store.summary().conflictCommands, 0);

    await new Promise((resolve) => setTimeout(resolve, 1_050));
    assert.equal(replayAuthorizations.length, 1);
    assert.equal(store.summary().pendingCommands, 1);

    const refreshedRead = await fetch(baseUrl + "/orders", {
      headers: { Authorization: refreshedAuthorization },
    });
    assert.equal(refreshedRead.status, 200);
    await waitFor(
      () =>
        store.summary().pendingCommands === 0 &&
        store.summary().sendingCommands === 0,
    );
    assert.deepEqual(replayAuthorizations, [
      authorization,
      refreshedAuthorization,
    ]);
    assert.equal(store.summary().conflictCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("expired replay racing a session refresh resumes with the newest token", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-auth-race-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-auth-race", "branch-1");
  cachePosCatalog(store, authorization, 8_000);
  const refreshedAuthorization = desktopJwt("cashier-auth-race", "branch-1", {
    iat: 2,
  });
  let networkAvailable = false;
  let releaseOldReplay: ((response: Response) => void) | null = null;
  let announceOldReplay: (() => void) | null = null;
  const oldReplayStarted = new Promise<void>((resolve) => {
    announceOldReplay = resolve;
  });
  const replayAuthorizations: string[] = [];
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (!networkAvailable) throw new Error("offline");
      const requestAuthorization = new Headers(init?.headers).get(
        "authorization",
      );
      if (url.endsWith("/pos/orders") && init?.method === "POST") {
        replayAuthorizations.push(requestAuthorization ?? "");
        if (requestAuthorization === authorization) {
          announceOldReplay?.();
          return new Promise<Response>((resolve) => {
            releaseOldReplay = resolve;
          });
        }
        return jsonResponse({
          success: true,
          data: { id: "server-order-race" },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    const baseUrl = "http://127.0.0.1:" + port + "/api/v1";
    const queued = await fetch(baseUrl + "/pos/orders", {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "Idempotency-Key": "auth-race-offline-sale",
      },
      body: JSON.stringify({
        idempotencyKey: "auth-race-offline-sale",
        items: [{ productId: "product-1", quantity: 1 }],
        payments: [{ paymentMethodCode: "CASH", amount: 8_000 }],
      }),
    });
    assert.equal(queued.status, 202);

    networkAvailable = true;
    await waitFor(() => gateway.status().mode === "online", 4_000);
    await oldReplayStarted;
    const refreshedRead = await fetch(baseUrl + "/orders", {
      headers: { Authorization: refreshedAuthorization },
    });
    assert.equal(refreshedRead.status, 200);

    assert.ok(releaseOldReplay);
    releaseOldReplay(
      jsonResponse(
        { success: false, error: { message: "Access token expired" } },
        401,
      ),
    );
    await waitFor(
      () =>
        replayAuthorizations.length === 2 &&
        store.summary().pendingCommands === 0 &&
        store.summary().sendingCommands === 0,
    );
    assert.deepEqual(replayAuthorizations, [
      authorization,
      refreshedAuthorization,
    ]);
    assert.equal(store.summary().conflictCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway preserves a queued sale across permission refresh without reusing private cache", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const commonClaims = {
    credentialVersion: 3,
    tenantId: "tenant-1",
    membershipId: "membership-1",
  };
  const fullAuthorization = desktopJwt(
    "cashier-permission-refresh",
    "branch-1",
    {
      ...commonClaims,
      roles: ["cashier", "pos", "staff-viewer"],
      permissions: ["POS_USE", "ORDER_VIEW", "STAFF_VIEW"],
    },
  );
  const reducedAuthorization = desktopJwt(
    "cashier-permission-refresh",
    "branch-1",
    {
      ...commonClaims,
      roles: ["cashier", "pos"],
      permissions: ["POS_USE", "ORDER_VIEW"],
    },
  );
  const oldPermissionScope = DesktopStore.authScope(fullAuthorization);
  const cacheScope = DesktopStore.authScope(fullAuthorization);
  const staffUrl = "https://api.example.test/api/v1/staff";
  store.putCachedResponse({
    cacheKey: DesktopStore.cacheKey(staffUrl, cacheScope),
    requestUrl: staffUrl,
    authScope: cacheScope,
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      success: true,
      data: [{ id: "private-staff-record" }],
    }),
    cachedAt: new Date().toISOString(),
  });
  store.enqueueMutation({
    idempotencyKey: "permission-refresh-sale",
    commandType: "pos.order.create",
    aggregateType: "orders",
    aggregateId: "local-permission-refresh-order",
    actorId: "cashier-permission-refresh",
    branchId: "branch-1",
    authScope: oldPermissionScope,
    payload: {
      commandType: "pos.order.create",
      queuedEmployeeId: null,
      method: "POST",
      pathname: "/api/v1/pos/orders",
      targetUrl: "https://api.example.test/api/v1/pos/orders",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "permission-refresh-sale",
      },
      body: JSON.stringify({
        idempotencyKey: "permission-refresh-sale",
        payments: [{ paymentMethodCode: "CASH", amount: 19_000 }],
      }),
      queuedAt: new Date().toISOString(),
    },
  });
  assert.equal(store.summary().pendingCommands, 1);
  let online = false;
  let replayAuthorization: string | null = null;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input, init) => {
      if (!online) throw new Error("offline");
      const url = String(input);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (url.endsWith("/staff")) {
        return jsonResponse({
          success: true,
          data: [{ id: "private-staff-record" }],
        });
      }
      if (url.endsWith("/pos/orders") && init?.method === "POST") {
        replayAuthorization = new Headers(init.headers).get("authorization");
        return jsonResponse({ success: true, data: { id: "server-order-1" } });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const baseUrl = `http://127.0.0.1:${gatewayPort}/api/v1`;
    const privateRead = await fetch(baseUrl + "/staff", {
      headers: { Authorization: fullAuthorization },
    });
    assert.equal(privateRead.status, 200);
    assert.equal(privateRead.headers.get("x-mazetto-desktop"), "offline-cache");
    await waitFor(() => gateway.status().mode === "offline");

    const reducedPrivateRead = await fetch(baseUrl + "/staff", {
      headers: { Authorization: reducedAuthorization },
    });
    assert.equal(
      store.listActiveMutations(
        DesktopStore.mutationScope(reducedAuthorization),
      ).length,
      1,
    );
    assert.equal(reducedPrivateRead.status, 503);
    assert.equal(
      (await reducedPrivateRead.text()).includes("private-staff-record"),
      false,
    );

    online = true;
    await fetch(baseUrl + "/orders", {
      headers: { Authorization: reducedAuthorization },
    });
    await waitFor(
      () =>
        store.summary().pendingCommands === 0 &&
        store.summary().sendingCommands === 0 &&
        replayAuthorization === reducedAuthorization,
    );
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway exposes and manages the desktop outbox", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-3", "branch-1");
  cachePosCatalog(store, authorization, 11_000);
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const sale = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/pos/orders`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: "sale-key-outbox",
          items: [{ productId: "product-1", quantity: 1 }],
          payments: [{ paymentMethodCode: "CASH", amount: 11_000 }],
        }),
      },
    );
    assert.equal(sale.status, 202);

    const anonymousOutbox = await fetch(
      `http://127.0.0.1:${gatewayPort}/desktop/outbox`,
    );
    assert.equal(anonymousOutbox.status, 200);
    assert.deepEqual(
      ((await anonymousOutbox.json()) as { data: { commands: unknown[] } }).data
        .commands,
      [],
    );
    const otherScopeOutbox = await fetch(
      `http://127.0.0.1:${gatewayPort}/desktop/outbox`,
      {
        headers: {
          Authorization: desktopJwt("cashier-other", "branch-1"),
        },
      },
    );
    assert.deepEqual(
      ((await otherScopeOutbox.json()) as { data: { commands: unknown[] } })
        .data.commands,
      [],
    );

    const outbox = await fetch(
      `http://127.0.0.1:${gatewayPort}/desktop/outbox`,
      { headers: { Authorization: authorization } },
    );
    assert.equal(outbox.status, 200);
    const outboxPayload = (await outbox.json()) as {
      data: { commands: Array<{ id: string; payload: { pathname?: string } }> };
    };
    assert.equal(outboxPayload.data.commands.length, 1);
    assert.equal(
      outboxPayload.data.commands[0]?.payload.pathname,
      "/api/v1/pos/orders",
    );

    const commandId = outboxPayload.data.commands[0]!.id;
    const cancel = await fetch(
      "http://127.0.0.1:" +
        gatewayPort +
        "/desktop/outbox/" +
        commandId +
        "/cancel",
      { method: "POST", headers: { Authorization: authorization } },
    );
    assert.equal(cancel.status, 409);
    assert.equal(store.summary().pendingCommands, 1);

    const unauthenticatedCancel = await fetch(
      "http://127.0.0.1:" +
        gatewayPort +
        "/desktop/outbox/" +
        commandId +
        "/cancel",
      { method: "POST" },
    );
    assert.equal(unauthenticatedCancel.status, 401);

    const orderEdit = store.enqueueMutation({
      idempotencyKey: "order-edit-outbox-key",
      commandType: "order.items.update",
      aggregateType: "orders",
      aggregateId: "order-edit-12345678",
      actorId: "cashier-3",
      branchId: "branch-1",
      authScope: DesktopStore.mutationScope(authorization),
      payload: {
        method: "PATCH",
        pathname: "/api/v1/orders/order-edit-12345678/items/item-1",
        targetUrl:
          "https://api.example.test/api/v1/orders/order-edit-12345678/items/item-1",
        body: JSON.stringify({ orderId: "order-edit-12345678", quantity: 1 }),
      },
    });
    const safeCancel = await fetch(
      "http://127.0.0.1:" +
        gatewayPort +
        "/desktop/outbox/" +
        orderEdit.id +
        "/cancel",
      {
        method: "POST",
        headers: { Authorization: desktopJwt("cashier-other", "branch-1") },
      },
    );
    assert.equal(safeCancel.status, 409);
    assert.equal(store.summary().pendingCommands, 2);

    const ownCancel = await fetch(
      "http://127.0.0.1:" +
        gatewayPort +
        "/desktop/outbox/" +
        orderEdit.id +
        "/cancel",
      { method: "POST", headers: { Authorization: authorization } },
    );
    assert.equal(ownCancel.status, 200);
    assert.equal(store.summary().pendingCommands, 1);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway rejects unregistered offline mutations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const response = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/admin/users`,
      {
        method: "POST",
        headers: {
          Authorization: desktopJwt("admin-1", "branch-1"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "should-not-replay" }),
      },
    );
    assert.equal(response.status, 503);
    assert.equal(store.summary().pendingCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway sends server version conflicts to the conflict inbox", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-conflict", "branch-1");
  const authScope = DesktopStore.mutationScope(authorization);
  store.enqueueMutation({
    idempotencyKey: "conflict-key",
    commandType: "kitchen.action",
    aggregateType: "kitchen",
    aggregateId: "ticket-1",
    actorId: "cashier-conflict",
    branchId: "branch-1",
    authScope,
    payload: {
      commandType: "kitchen.action",
      queuedEmployeeId: null,
      method: "PATCH",
      pathname: "/api/v1/kitchen/orders/ticket-1/ready",
      targetUrl:
        "https://api.example.test/api/v1/kitchen/orders/ticket-1/ready",
      headers: { "idempotency-key": "conflict-key" },
      body: JSON.stringify({ expectedVersion: 2 }),
    },
  });
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }
      if (init?.method === "PATCH") {
        return new Response('{"code":"KITCHEN_VERSION_CONFLICT"}', {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const refresh = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/branches`,
      { headers: { Authorization: authorization } },
    );
    assert.equal(refresh.status, 200);
    await waitFor(() => store.summary().conflictCommands === 1);
    assert.equal(store.summary().pendingCommands, 0);
    assert.match(store.listOutbox()[0]?.lastError ?? "", /CONFLICT/);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("offline payment setting errors stay readable and can be retried", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-payment-conflict-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-disabled-method", "branch-1", {
    employeeId: "employee-disabled-method",
  });
  const authScope = DesktopStore.mutationScope(authorization);
  const queued = store.enqueueMutation({
    idempotencyKey: "cash-method-disabled-retry",
    commandType: "payment.process",
    aggregateType: "orders",
    aggregateId: "order-1",
    actorId: "cashier-disabled-method",
    branchId: "branch-1",
    authScope,
    payload: {
      commandType: "payment.process",
      queuedEmployeeId: "employee-disabled-method",
      method: "POST",
      pathname: "/api/v1/payments/process",
      targetUrl: "https://api.example.test/api/v1/payments/process",
      headers: { "idempotency-key": "cash-method-disabled-retry" },
      body: JSON.stringify({
        orderId: "order-1",
        shiftId: "shift-1",
        idempotencyKey: "cash-method-disabled-retry",
        payments: [{ paymentMethodCode: "CASH", amount: 1_000 }],
      }),
    },
  });
  let cashMethodEnabled = false;
  let paymentAttempts = 0;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/health")) return jsonResponse({ ok: true });
      if (url.endsWith("/payments/process")) {
        paymentAttempts++;
        if (!cashMethodEnabled) {
          return new Response(
            JSON.stringify({
              success: false,
              message: ["Naqd to'lov sozlamalarda o'chirilgan."],
              error: "Bad Request",
              statusCode: 400,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        return jsonResponse({ success: true, data: { id: "payment-1" } });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const baseUrl = `http://127.0.0.1:${gatewayPort}`;
    const refresh = await fetch(`${baseUrl}/api/v1/branches`, {
      headers: { Authorization: authorization },
    });
    assert.equal(refresh.status, 200);
    await waitFor(() => store.summary().conflictCommands === 1);
    const conflict = store.listOutbox(10, authScope)[0];
    assert.equal(conflict?.id, queued.id);
    assert.equal(conflict?.lastError, "Naqd to'lov sozlamalarda o'chirilgan.");

    cashMethodEnabled = true;
    const retry = await fetch(`${baseUrl}/desktop/outbox/${queued.id}/retry`, {
      method: "POST",
      headers: { Authorization: authorization },
    });
    assert.equal(retry.status, 200);
    await waitFor(
      () =>
        store.summary().pendingCommands === 0 &&
        store.summary().conflictCommands === 0,
    );
    assert.equal(store.summary().pendingCommands, 0);
    assert.equal(store.summary().conflictCommands, 0);
    assert.equal(paymentAttempts, 2);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("gateway resolves local aggregate IDs before replaying dependents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-dependency", "branch-1");
  cachePosCatalog(store, authorization, 25_000);
  const sent: string[] = [];
  let online = false;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input, init) => {
      if (!online) {
        throw new Error("offline");
      }
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }
      if (init?.method === "POST" && url.endsWith("/pos/orders")) {
        sent.push(`${init.method} ${url}`);
        return jsonResponse({
          success: true,
          data: { order: { id: "server-order-1" } },
        });
      }
      if (
        init?.method === "PATCH" &&
        url.endsWith("/orders/server-order-1/status")
      ) {
        sent.push(`${init.method} ${url}`);
        return jsonResponse({
          success: true,
          data: { order: { id: "server-order-1" } },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const sale = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/pos/orders`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: "dependency-sale",
          items: [{ productId: "product-1", quantity: 1 }],
          payments: [{ paymentMethodCode: "CASH", amount: 25_000 }],
        }),
      },
    );
    assert.equal(sale.status, 202);
    const salePayload = (await sale.json()) as {
      data: { order: { id: string } };
    };
    assert.match(salePayload.data.order.id, /^local-/);

    const dependent = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/orders/${salePayload.data.order.id}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": "dependency-status-key",
        },
        body: JSON.stringify({ status: "CONFIRMED", expectedVersion: 0 }),
      },
    );
    assert.equal(dependent.status, 202);
    assert.equal(store.summary().pendingCommands, 2);

    online = true;
    const refresh = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/branches`,
      {
        headers: { Authorization: authorization },
      },
    );
    assert.equal(refresh.status, 503);
    await waitFor(() => gateway.status().mode === "online");
    const recovered = await fetch(
      "http://127.0.0.1:" + gatewayPort + "/api/v1/branches",
      { headers: { Authorization: authorization } },
    );
    assert.equal(recovered.status, 200);
    await waitFor(
      () =>
        store.summary().pendingCommands === 0 &&
        store.summary().sendingCommands === 0,
    );
    assert.deepEqual(sent, [
      "POST https://api.example.test/api/v1/pos/orders",
      "PATCH https://api.example.test/api/v1/orders/server-order-1/status",
    ]);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("conflicted offline order creation blocks only its dependent commands", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-dependency-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-dependency-conflict", "branch-1");
  cachePosCatalog(store, authorization, 10_000);
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const createOrder = async (idempotencyKey: string) => {
      const response = await fetch(
        `http://127.0.0.1:${gatewayPort}/api/v1/pos/orders`,
        {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idempotencyKey,
            items: [{ productId: "product-1", quantity: 1 }],
            payments: [{ paymentMethodCode: "CASH", amount: 10_000 }],
          }),
        },
      );
      assert.equal(response.status, 202);
      return (await response.json()) as { data: { order: { id: string } } };
    };

    const firstOrder = await createOrder("dependency-conflict-sale-1");
    const dependentResponse = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/orders/${firstOrder.data.order.id}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": "dependency-conflict-status-key",
        },
        body: JSON.stringify({ status: "CONFIRMED", expectedVersion: 0 }),
      },
    );
    assert.equal(dependentResponse.status, 202);
    await createOrder("dependency-conflict-sale-2");

    const commands = store.listOutbox();
    assert.equal(commands.length, 3);
    assert.ok(commands.every((command) => command.aggregateType === "orders"));
    assert.equal(commands[0]?.aggregateId, commands[1]?.aggregateId);
    assert.notEqual(commands[0]?.aggregateId, commands[2]?.aggregateId);

    const authScope = commands[0]!.authScope;
    store.markMutationConflict(commands[0]!.id, "create requires review");
    assert.deepEqual(
      store.dueMutations(authScope, 10).map((command) => command.id),
      [commands[2]!.id],
    );
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway can retry a blocked outbox command", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-4", "branch-1", {
    employeeId: "employee-4",
  });
  const authScope = DesktopStore.mutationScope(authorization);
  const command = store.enqueueMutation({
    idempotencyKey: "blocked-key",
    commandType: "POST /api/v1/pos/orders",
    aggregateType: "pos",
    actorId: "cashier-4",
    branchId: "branch-1",
    authScope,
    payload: {
      queuedEmployeeId: "employee-4",
      method: "POST",
      pathname: "/api/v1/pos/orders",
      targetUrl: "https://api.example.test/api/v1/pos/orders",
    },
  });
  store.markMutationConflict(command.id, "validation failed");
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async () => jsonResponse({ success: true, data: { ok: true } }),
  });

  try {
    const gatewayPort = await gateway.start();
    const retry = await fetch(
      `http://127.0.0.1:${gatewayPort}/desktop/outbox/${command.id}/retry`,
      { method: "POST", headers: { Authorization: authorization } },
    );
    assert.equal(retry.status, 200);
    await waitFor(() => store.listOutbox().length === 0);
    assert.equal(store.summary().conflictCommands, 0);
    assert.equal(store.summary().pendingCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway compares a conflicted command with the current server resource", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-compare", "branch-1");
  const authScope = DesktopStore.mutationScope(authorization);
  const command = store.enqueueMutation({
    idempotencyKey: "compare-key",
    commandType: "kitchen.action",
    aggregateType: "kitchen",
    aggregateId: "ticket-1",
    baseVersion: 2,
    actorId: "cashier-compare",
    branchId: "branch-1",
    authScope,
    payload: {
      commandType: "kitchen.action",
      method: "POST",
      pathname: "/api/v1/kitchen/orders/ticket-1/ready",
      targetUrl:
        "https://api.example.test/api/v1/kitchen/orders/ticket-1/ready",
      headers: { "idempotency-key": "compare-key" },
      body: JSON.stringify({ expectedVersion: 2, status: "READY" }),
    },
  });
  store.markMutationConflict(command.id, "CONFLICT: server version 3");
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }
      assert.equal(init?.method, "GET");
      assert.equal(
        url,
        "https://api.example.test/api/v1/kitchen/orders/ticket-1",
      );
      return jsonResponse({
        success: true,
        data: { id: "ticket-1", version: 3, status: "COOKING" },
      });
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const response = await fetch(
      `http://127.0.0.1:${gatewayPort}/desktop/outbox/${command.id}/compare`,
      { headers: { Authorization: authorization } },
    );
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      data: {
        command: { canCancel: boolean; payload: { body: unknown } };
        comparison: {
          resourcePath: string;
          expectedVersion: number | null;
          server: { status: number; body: unknown };
        };
      };
    };
    assert.equal(
      payload.data.comparison.resourcePath,
      "/api/v1/kitchen/orders/ticket-1",
    );
    assert.equal(payload.data.comparison.expectedVersion, 2);
    assert.equal(payload.data.comparison.server.status, 200);
    assert.equal(payload.data.command.canCancel, false);
    assert.deepEqual(payload.data.command.payload.body, {
      expectedVersion: 2,
      status: "READY",
    });
    assert.deepEqual(payload.data.comparison.server.body, {
      success: true,
      data: { id: "ticket-1", version: 3, status: "COOKING" },
    });
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway projects pending POS orders into cached order reads and compensates after acknowledgement", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-projection", "branch-1");
  cachePosCatalog(store, authorization, 25_000);
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input, init) => {
      if (!online) throw new Error("offline");
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }
      if (
        (init?.method ?? "GET") === "GET" &&
        url.endsWith("/kitchen/orders")
      ) {
        return jsonResponse({
          success: true,
          data: {
            items: [],
            hasMore: false,
            limit: 80,
            kitchenPosOrdersEnabled: false,
          },
        });
      }
      if ((init?.method ?? "GET") === "GET" && url.endsWith("/orders")) {
        return jsonResponse([]);
      }
      return jsonResponse({ success: true, data: { ok: true } });
    },
  });

  try {
    const gatewayPort = await gateway.start();
    const initial = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/orders`,
      {
        headers: { Authorization: authorization },
      },
    );
    assert.equal(initial.status, 200);
    assert.deepEqual(await initial.json(), []);
    const initialKitchen = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/kitchen/orders`,
      { headers: { Authorization: authorization } },
    );
    assert.equal(initialKitchen.status, 200);

    online = false;
    const sale = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/pos/orders`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: "projection-sale",
          items: [{ productId: "product-1", quantity: 1 }],
          payments: [{ paymentMethodCode: "CASH", amount: 25_000 }],
        }),
      },
    );
    assert.equal(sale.status, 202);
    const salePayload = (await sale.json()) as { data: { commandId: string } };

    const projected = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/orders`,
      {
        headers: { Authorization: authorization },
      },
    );
    assert.equal(projected.status, 200);
    assert.equal(
      projected.headers.get("x-mazetto-desktop"),
      "offline-optimistic",
    );
    const projectedOrders = (await projected.json()) as Array<
      Record<string, unknown>
    >;
    assert.equal(projectedOrders.length, 1);
    assert.equal(projectedOrders[0]?.pendingSync, true);
    assert.equal(projectedOrders[0]?.commandId, salePayload.data.commandId);

    const hiddenKitchen = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/kitchen/orders`,
      { headers: { Authorization: authorization } },
    );
    const hiddenKitchenBody = (await hiddenKitchen.json()) as {
      data: { items: unknown[] };
    };
    assert.equal(hiddenKitchenBody.data.items.length, 0);

    const kitchenUrl = "https://api.example.test/api/v1/kitchen/orders";
    const authScope = DesktopStore.authScope(authorization);
    store.putCachedResponse({
      cacheKey: DesktopStore.cacheKey(kitchenUrl, authScope),
      requestUrl: kitchenUrl,
      authScope,
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          items: [],
          hasMore: false,
          limit: 80,
          kitchenPosOrdersEnabled: true,
        },
      }),
      cachedAt: new Date().toISOString(),
    });
    const enabledKitchen = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/kitchen/orders`,
      { headers: { Authorization: authorization } },
    );
    const enabledKitchenBody = (await enabledKitchen.json()) as {
      data: { items: Array<Record<string, unknown>> };
    };
    assert.equal(enabledKitchenBody.data.items.length, 1);

    store.markMutationAcknowledged(salePayload.data.commandId);
    const compensated = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/orders`,
      { headers: { Authorization: authorization } },
    );
    assert.equal(compensated.status, 200);
    assert.equal(compensated.headers.get("x-mazetto-desktop"), "offline-cache");
    assert.deepEqual(await compensated.json(), []);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

function desktopJwt(
  userId: string,
  branchId: string,
  claims: Record<string, unknown> = {},
): string {
  const payload = Buffer.from(
    JSON.stringify({
      id: userId,
      branchId,
      isGlobalScope: false,
      ...claims,
    }),
  ).toString("base64url");
  return `Bearer header.${payload}.signature`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  assert.equal(predicate(), true);
}

test("gateway queues waiter table orders offline and replays the local order chain", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-waiter-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("waiter-offline", "branch-1");
  const table = {
    id: "table-1",
    branchId: "branch-1",
    name: "1-stol",
    status: "AVAILABLE",
    orders: [],
  };
  const product = {
    id: "product-1",
    name: "Lavash",
    printerRouting: "KITCHEN",
    sellingPrice: "12000.00",
    variants: [{ id: "variant-1", name: "Katta", sellingPrice: "15000.00" }],
    modifiers: [
      { modifier: { id: "extra-cheese", name: "Pishloq", price: "2000.00" } },
    ],
  };
  const drink = {
    id: "product-2",
    name: "Coca Cola",
    printerRouting: "RECEIPT",
    sellingPrice: "5000.00",
    variants: [],
    modifiers: [],
  };
  const sent: Array<{ url: string; body: string; key: string | null }> = [];
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        if (!online) throw new Error("offline");
        return jsonResponse({ success: true, data: { ok: true } });
      }
      if (!online) throw new Error("offline");
      if (
        init?.method === "GET" &&
        url.endsWith("/realtime/bootstrap?branchId=branch-1")
      ) {
        return jsonResponse({
          success: true,
          data: {
            schemaVersion: 2,
            generatedAt: new Date().toISOString(),
            branchId: "branch-1",
            menu: { categories: [], products: [product, drink] },
            tables: [table],
          },
        });
      }
      if (init?.method === "GET" && url.endsWith("/kitchen/orders")) {
        return jsonResponse({
          success: true,
          data: { items: [], hasMore: false, limit: 80 },
        });
      }
      if (init?.method === "POST") {
        sent.push({
          url,
          body: String(init.body ?? ""),
          key: new Headers(init.headers).get("idempotency-key"),
        });
        if (url.endsWith("/tables/table-1/orders")) {
          return jsonResponse({
            success: true,
            data: { id: "server-order-1", version: 0, items: [] },
          });
        }
        if (url.endsWith("/orders/server-order-1/items")) {
          return jsonResponse({
            success: true,
            data: {
              id: "server-order-1",
              version: 1,
              items: [{ id: "server-item-1" }],
            },
          });
        }
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    for (const path of [
      "/api/v1/realtime/bootstrap?branchId=branch-1",
      "/api/v1/kitchen/orders",
    ]) {
      const response = await fetch("http://127.0.0.1:" + port + path, {
        headers: { Authorization: authorization },
      });
      assert.equal(response.status, 200);
    }

    online = false;
    const opened = await fetch(
      "http://127.0.0.1:" + port + "/api/v1/tables/table-1/orders",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": "waiter-open-key",
        },
        body: JSON.stringify({ guestCount: 2, notes: "Deraza yonida" }),
      },
    );
    assert.equal(opened.status, 202);
    const openedData = (await opened.json()).data as {
      id: string;
      pendingSync: boolean;
    };
    assert.match(openedData.id, /^local-/);
    assert.equal(openedData.pendingSync, true);

    const readDetail = async () => {
      const response = await fetch(
        "http://127.0.0.1:" + port + "/api/v1/tables/table-1",
        { headers: { Authorization: authorization } },
      );
      assert.equal(response.status, 200);
      return (await response.json()).data as {
        status: string;
        orders: Array<{
          id: string;
          version: number;
          guestCount: number;
          total: string;
          items: Array<Record<string, unknown>>;
        }>;
      };
    };
    const openedDetail = await readDetail();
    assert.equal(openedDetail.status, "OCCUPIED");
    assert.equal(openedDetail.orders[0]?.id, openedData.id);
    assert.equal(openedDetail.orders[0]?.guestCount, 2);

    const added = await fetch(
      "http://127.0.0.1:" + port + "/api/v1/orders/" + openedData.id + "/items",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": "waiter-item-key",
        },
        body: JSON.stringify({
          productId: "product-1",
          variantId: "variant-1",
          quantity: 2,
          expectedVersion: 0,
          modifiers: [{ modifierId: "extra-cheese", quantity: 1 }],
        }),
      },
    );
    assert.equal(added.status, 202);
    const addedData = (await added.json()).data as {
      id: string;
      item: { productName: string; totalPrice: string };
    };
    assert.match(addedData.id, /^local-/);
    assert.equal(addedData.item.productName, "Lavash");
    assert.equal(addedData.item.totalPrice, "34000.00");

    const addedDrink = await fetch(
      "http://127.0.0.1:" + port + "/api/v1/orders/" + openedData.id + "/items",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": "waiter-drink-key",
        },
        body: JSON.stringify({
          productId: "product-2",
          quantity: 1,
          expectedVersion: 1,
        }),
      },
    );
    assert.equal(addedDrink.status, 202);
    const addedDrinkData = (await addedDrink.json()).data as {
      id: string;
      item: { productName: string; totalPrice: string };
    };
    assert.equal(addedDrinkData.item.productName, "Coca Cola");
    assert.equal(addedDrinkData.item.totalPrice, "5000.00");

    const projected = await readDetail();
    assert.equal(projected.orders[0]?.version, 2);
    assert.equal(projected.orders[0]?.total, "39000.00");
    assert.equal(projected.orders[0]?.items[0]?.id, addedData.id);
    assert.equal(projected.orders[0]?.items[1]?.id, addedDrinkData.id);
    const kitchen = await fetch(
      "http://127.0.0.1:" + port + "/api/v1/kitchen/orders",
      { headers: { Authorization: authorization } },
    );
    assert.equal(kitchen.status, 200);
    const kitchenBody = (await kitchen.json()) as {
      data: { items: Array<Record<string, unknown>> };
    };
    assert.equal(kitchenBody.data.items.length, 1);
    const ticket = kitchenBody.data.items[0];
    assert.equal(ticket?.pendingSync, true);
    const ticketItems = ticket?.items as Array<Record<string, unknown>>;
    const kitchenOrder = ticket?.order as Record<string, unknown>;
    assert.equal(ticketItems.length, 1);
    assert.equal(ticketItems[0]?.id, addedData.id);
    assert.equal(ticketItems[0]?.productName, "Lavash");
    assert.equal(ticketItems[0]?.variantName, "Katta");
    assert.equal(ticketItems[0]?.quantity, "2");
    assert.equal(kitchenOrder.id, openedData.id);
    assert.equal(
      (kitchenOrder.items as Array<Record<string, unknown>>).length,
      2,
    );
    assert.equal(kitchenOrder.source, "POS");
    assert.equal(kitchenOrder.type, "DINE_IN");
    assert.equal(
      (kitchenOrder.table as Record<string, unknown> | undefined)?.name,
      "1-stol",
    );
    assert.equal(store.summary().pendingCommands, 3);

    online = true;
    await waitFor(() => gateway.status().mode === "online");
    const trigger = await fetch(
      "http://127.0.0.1:" + port + "/api/v1/branches",
      {
        headers: { Authorization: authorization },
      },
    );
    assert.equal(trigger.status, 200);
    await waitFor(() => store.summary().pendingCommands === 0, 3_000);
    assert.equal(sent.length, 3);
    assert.equal(
      sent[0]?.url,
      "https://api.example.test/api/v1/tables/table-1/orders",
    );
    assert.equal(sent[0]?.key, "waiter-open-key");
    assert.equal(
      sent[1]?.url,
      "https://api.example.test/api/v1/orders/server-order-1/items",
    );
    assert.equal(sent[1]?.key, "waiter-item-key");
    assert.equal(JSON.parse(sent[1]?.body ?? "{}").expectedVersion, 0);
    assert.equal(
      sent[2]?.url,
      "https://api.example.test/api/v1/orders/server-order-1/items",
    );
    assert.equal(sent[2]?.key, "waiter-drink-key");
    assert.equal(JSON.parse(sent[2]?.body ?? "{}").expectedVersion, 1);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("waiter offline item writes require a branch-bound order and current version", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-waiter-version-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("waiter-version-gate", "branch-1");
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) => {
      if (!online) throw new Error("offline");
      const url = String(input);
      if (url.endsWith("/health")) return jsonResponse({ success: true });
      if (url.endsWith("/realtime/bootstrap?branchId=branch-1")) {
        return jsonResponse({
          success: true,
          data: {
            schemaVersion: 2,
            generatedAt: new Date().toISOString(),
            branchId: "branch-1",
            menu: {
              categories: [],
              products: [
                {
                  id: "product-1",
                  name: "Lavash",
                  sellingPrice: "12000.00",
                  variants: [],
                  modifiers: [],
                },
              ],
            },
            tables: [
              {
                id: "table-1",
                branchId: "branch-1",
                name: "1-stol",
                status: "OCCUPIED",
                orders: [
                  {
                    id: "server-order-1",
                    branchId: "branch-1",
                    version: 4,
                    status: "CONFIRMED",
                    total: "12000.00",
                    items: [],
                  },
                ],
              },
              {
                id: "foreign-table",
                branchId: "branch-2",
                name: "B-filial",
                status: "OCCUPIED",
                orders: [
                  {
                    id: "foreign-order",
                    branchId: "branch-2",
                    version: 1,
                    status: "CONFIRMED",
                    items: [],
                  },
                ],
              },
            ],
          },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const warm = await fetch(
      "http://127.0.0.1:" +
        port +
        "/api/v1/realtime/bootstrap?branchId=branch-1",
      { headers: { Authorization: authorization } },
    );
    assert.equal(warm.status, 200);

    online = false;
    const request = (
      orderId: string,
      body: Record<string, unknown>,
      key: string,
    ) =>
      fetch(
        "http://127.0.0.1:" + port + "/api/v1/orders/" + orderId + "/items",
        {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify(body),
        },
      );
    const stale = await request(
      "server-order-1",
      {
        productId: "product-1",
        quantity: 1,
        expectedVersion: 3,
      },
      "waiter-stale-version",
    );
    assert.equal(stale.status, 503);
    assert.match((await stale.json()).error.message, /yangilangan/);
    assert.equal(store.summary().pendingCommands, 0);

    const missingVersion = await request(
      "server-order-1",
      { productId: "product-1", quantity: 1 },
      "waiter-missing-version",
    );
    assert.equal(missingVersion.status, 503);
    assert.equal(store.summary().pendingCommands, 0);

    const foreign = await request(
      "foreign-order",
      {
        productId: "product-1",
        quantity: 1,
        expectedVersion: 1,
      },
      "waiter-foreign-order",
    );
    assert.equal(foreign.status, 503);
    assert.equal(store.summary().pendingCommands, 0);

    const first = await request(
      "server-order-1",
      {
        productId: "product-1",
        quantity: 1,
        expectedVersion: 4,
      },
      "waiter-current-version",
    );
    assert.equal(first.status, 202);
    const second = await request(
      "server-order-1",
      {
        productId: "product-1",
        quantity: 1,
        expectedVersion: 5,
      },
      "waiter-rebased-version",
    );
    assert.equal(second.status, 202);
    assert.equal(store.summary().pendingCommands, 2);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("waiter quantity and note edits project offline and replay with rebased versions", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-waiter-edit-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("waiter-edit", "branch-1");
  let online = true;
  let serverVersion = 4;
  let serverQuantity = 2;
  let serverNotes = "";
  const replayedVersions: number[] = [];
  const table = {
    id: "table-1",
    branchId: "branch-1",
    name: "1-stol",
    status: "OCCUPIED",
    orders: [
      {
        id: "server-order-1",
        branchId: "branch-1",
        version: 4,
        status: "CONFIRMED",
        total: "24000.00",
        items: [
          {
            id: "item-1",
            productId: "product-1",
            productName: "Lavash",
            quantity: "2",
            unitPrice: "12000.00",
            totalPrice: "24000.00",
            status: "ACTIVE",
            notes: "",
            modifierSnapshot: [],
          },
        ],
      },
    ],
  };
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    probeIntervalMs: 25,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/health"))
        return jsonResponse({ success: true });
      if (url.pathname === "/api/v1/realtime/bootstrap") {
        return jsonResponse({
          success: true,
          data: {
            schemaVersion: 2,
            generatedAt: new Date().toISOString(),
            branchId: "branch-1",
            menu: { categories: [], products: [] },
            tables: [
              table,
              {
                id: "foreign-table",
                branchId: "branch-2",
                name: "B-filial",
                status: "OCCUPIED",
                orders: [
                  {
                    id: "foreign-order",
                    branchId: "branch-2",
                    version: 1,
                    status: "CONFIRMED",
                    total: "24000.00",
                    items: [
                      {
                        id: "item-1",
                        productName: "Lavash",
                        quantity: "2",
                        unitPrice: "12000.00",
                        totalPrice: "24000.00",
                        status: "ACTIVE",
                        notes: "",
                        modifierSnapshot: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        });
      }
      if (url.pathname === "/api/v1/tables/table-1") {
        return jsonResponse({ success: true, data: table });
      }
      if (!online) throw new Error("offline");
      if (
        url.pathname === "/api/v1/orders/server-order-1/items/item-1" &&
        init?.method === "PATCH"
      ) {
        const body = JSON.parse(String(init.body ?? "{}")) as {
          expectedVersion?: number;
          quantity?: number;
          notes?: string;
        };
        replayedVersions.push(body.expectedVersion ?? -1);
        if (body.expectedVersion !== serverVersion) {
          return jsonResponse(
            { success: false, error: { message: "version conflict" } },
            409,
          );
        }
        if (body.quantity !== undefined) serverQuantity = body.quantity;
        if (body.notes !== undefined) serverNotes = body.notes;
        serverVersion += 1;
        return jsonResponse({
          success: true,
          data: { id: "server-order-1", version: serverVersion },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const request = (path: string, init: RequestInit = {}) =>
      fetch(`http://127.0.0.1:${port}${path}`, {
        ...init,
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
    const bootstrap = await request(
      "/api/v1/realtime/bootstrap?branchId=branch-1",
    );
    assert.equal(bootstrap.status, 200);
    const tableDetail = await request(
      "/api/v1/tables/table-1?branchId=branch-1",
    );
    assert.equal(tableDetail.status, 200);

    online = false;
    const patch = (body: Record<string, unknown>, key: string) =>
      request("/api/v1/orders/server-order-1/items/item-1", {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      });
    const first = await patch(
      { quantity: 3, notes: "kam tuz", expectedVersion: 4 },
      "waiter-edit-quantity",
    );
    assert.equal(first.status, 202);
    const second = await patch(
      { notes: "kunjut qo'shilsin", expectedVersion: 5 },
      "waiter-edit-notes",
    );
    assert.equal(second.status, 202);

    const projectedResponse = await request(
      "/api/v1/tables/table-1?branchId=branch-1",
    );
    const projected = (await projectedResponse.json()) as {
      data: {
        orders: Array<{
          version: number;
          total: string;
          items: Array<Record<string, unknown>>;
        }>;
      };
    };
    const projectedOrder = projected.data.orders[0]!;
    assert.equal(projectedOrder.version, 6);
    assert.equal(projectedOrder.total, "36000.00");
    assert.equal(projectedOrder.items[0]?.quantity, "3");
    assert.equal(projectedOrder.items[0]?.totalPrice, "36000.00");
    assert.equal(projectedOrder.items[0]?.notes, "kunjut qo'shilsin");
    assert.equal(projectedOrder.items[0]?.pendingSync, true);

    const stale = await patch(
      { notes: "stale", expectedVersion: 5 },
      "waiter-edit-stale-version",
    );
    assert.equal(stale.status, 503);
    const foreign = await request("/api/v1/orders/foreign-order/items/item-1", {
      method: "PATCH",
      headers: { "Idempotency-Key": "waiter-edit-cross-branch" },
      body: JSON.stringify({ quantity: 4, expectedVersion: 1 }),
    });
    assert.equal(foreign.status, 503);
    const invalidQuantity = await patch(
      { quantity: 100, expectedVersion: 6 },
      "waiter-edit-invalid-quantity",
    );
    assert.equal(invalidQuantity.status, 503);
    const unsupported = await patch(
      { modifiers: [], expectedVersion: 6 },
      "waiter-edit-modifiers-online-only",
    );
    assert.equal(unsupported.status, 503);
    assert.equal(store.summary().pendingCommands, 2);

    online = true;
    await waitFor(
      () =>
        store.summary().pendingCommands === 0 &&
        store.summary().sendingCommands === 0,
      8000,
    );
    assert.deepEqual(replayedVersions, [4, 5]);
    assert.equal(serverVersion, 6);
    assert.equal(serverQuantity, 3);
    assert.equal(serverNotes, "kunjut qo'shilsin");
    assert.equal(store.summary().conflictCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("waiter offline writes reject a bootstrap snapshot owned by another branch", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-waiter-tenant-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("waiter-cross-branch", "branch-1");
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        if (!online) throw new Error("offline");
        return jsonResponse({ success: true });
      }
      if (!online) throw new Error("offline");
      if (
        init?.method === "GET" &&
        url.endsWith("/realtime/bootstrap?branchId=branch-1")
      ) {
        return jsonResponse({
          success: true,
          data: {
            schemaVersion: 2,
            generatedAt: new Date().toISOString(),
            branchId: "branch-2",
            tables: [
              {
                id: "table-2",
                branchId: "branch-2",
                name: "B-filial stoli",
                status: "AVAILABLE",
                orders: [],
              },
            ],
          },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const warm = await fetch(
      "http://127.0.0.1:" +
        port +
        "/api/v1/realtime/bootstrap?branchId=branch-1",
      { headers: { Authorization: authorization } },
    );
    assert.equal(warm.status, 200);

    online = false;
    const response = await fetch(
      "http://127.0.0.1:" + port + "/api/v1/tables/table-2/orders",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": "wrong-branch-table-open",
        },
        body: JSON.stringify({ guestCount: 2 }),
      },
    );
    assert.equal(response.status, 503);
    assert.equal(
      (await response.json()).error.code,
      "OFFLINE_WAITER_CACHE_MISSING",
    );
    assert.equal(store.summary().pendingCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("queued writes for one order rebase versions after every server acknowledgement", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-order-rebase-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("waiter-rebase", "branch-1");
  const sentVersions: number[] = [];
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input, init) => {
      if (!online) throw new Error("offline");
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }
      if (url.endsWith("/realtime/bootstrap?branchId=branch-1")) {
        return jsonResponse({
          success: true,
          data: {
            schemaVersion: 2,
            generatedAt: new Date().toISOString(),
            branchId: "branch-1",
            menu: {
              categories: [],
              products: [0, 1, 2].map((index) => ({
                id: "product-" + index,
                name: "Mahsulot " + index,
                sellingPrice: "1000.00",
                variants: [],
                modifiers: [],
              })),
            },
            tables: [
              {
                id: "table-1",
                branchId: "branch-1",
                name: "1-stol",
                status: "OCCUPIED",
                orders: [
                  {
                    id: "order-rebase",
                    branchId: "branch-1",
                    version: 10,
                    status: "CONFIRMED",
                    total: "0.00",
                    items: [],
                  },
                ],
              },
            ],
          },
        });
      }
      if (url.endsWith("/realtime/bootstrap?branchId=branch-1")) {
        return jsonResponse({
          success: true,
          data: {
            schemaVersion: 2,
            generatedAt: new Date().toISOString(),
            branchId: "branch-1",
            menu: {
              categories: [],
              products: [0, 1, 2].map((index) => ({
                id: "product-" + index,
                name: "Mahsulot " + index,
                sellingPrice: "1000.00",
                variants: [],
                modifiers: [],
              })),
            },
            tables: [
              {
                id: "table-1",
                branchId: "branch-1",
                name: "1-stol",
                status: "OCCUPIED",
                orders: [
                  {
                    id: "order-rebase",
                    branchId: "branch-1",
                    version: 10,
                    status: "CONFIRMED",
                    total: "0.00",
                    items: [],
                  },
                ],
              },
            ],
          },
        });
      }
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}")) as {
          expectedVersion?: number;
        };
        sentVersions.push(body.expectedVersion ?? -1);
        return jsonResponse({
          success: true,
          data: { id: "order-rebase", version: 10 + sentVersions.length },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const warm = await fetch(
      "http://127.0.0.1:" +
        port +
        "/api/v1/realtime/bootstrap?branchId=branch-1",
      { headers: { Authorization: authorization } },
    );
    assert.equal(warm.status, 200);
    online = false;
    for (let index = 0; index < 3; index += 1) {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v1/orders/order-rebase/items`,
        {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
            "Idempotency-Key": `offline-order-item-${index}`,
          },
          body: JSON.stringify({
            productId: `product-${index}`,
            quantity: 1,
            expectedVersion: 10 + index,
          }),
        },
      );
      assert.equal(response.status, 202);
    }

    online = true;
    await waitFor(() => sentVersions.length === 3, 3_000);
    assert.deepEqual(sentVersions, [10, 11, 12]);
    await waitFor(() => store.summary().pendingCommands === 0);
    const commands = store.listOutbox(10);
    assert.ok(commands.every((command) => command.state === "acknowledged"));
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline kitchen actions are blocked when no authorized queue snapshot is cached", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-kitchen-cache-missing-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("kitchen-cache-missing", "branch-1");
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });

  try {
    const port = await gateway.start();
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;
    const disconnected = await fetch(`${baseUrl}/branches`, {
      headers: { Authorization: authorization },
    });
    assert.equal(disconnected.status, 503);

    const response = await fetch(
      `${baseUrl}/kitchen/orders/ticket-not-cached/ready`,
      {
        method: "PATCH",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": "offline-kitchen-no-snapshot",
        },
        body: JSON.stringify({ expectedVersion: 1 }),
      },
    );

    assert.equal(response.status, 409);
    assert.equal(
      ((await response.json()) as { error: { code: string } }).error.code,
      "OFFLINE_KITCHEN_MUTATION_UNSAFE",
    );
    assert.equal(store.summary().pendingCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline kitchen actions project status and rebase versions during replay", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-kitchen-rebase-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("kitchen-rebase", "branch-1");
  const sent: Array<{ action: string; expectedVersion: number }> = [];
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input, init) => {
      if (!online) throw new Error("offline");
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }
      if (
        (init?.method ?? "GET") === "GET" &&
        url.endsWith("/kitchen/orders")
      ) {
        return jsonResponse({
          success: true,
          data: [
            {
              id: "ticket-rebase",
              status: "NEW",
              version: 5,
              order: { id: "order-rebase", branchId: "branch-1" },
            },
            {
              id: "ticket-other-branch",
              status: "NEW",
              version: 5,
              order: { id: "order-other-branch", branchId: "branch-2" },
            },
          ],
        });
      }
      if (init?.method === "PATCH") {
        const action = new URL(url).pathname.split("/").at(-1) ?? "";
        const body = JSON.parse(String(init.body ?? "{}")) as {
          expectedVersion?: number;
        };
        sent.push({ action, expectedVersion: body.expectedVersion ?? -1 });
        return jsonResponse({
          success: true,
          data: {
            id: "ticket-rebase",
            status: action.toUpperCase(),
            version: 10 + sent.length,
          },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    const kitchenPath = `http://127.0.0.1:${port}/api/v1/kitchen/orders`;
    const initial = await fetch(kitchenPath, {
      headers: { Authorization: authorization },
    });
    assert.equal(initial.status, 200);
    online = false;

    const staleVersion = await fetch(`${kitchenPath}/ticket-rebase/accept`, {
      method: "PATCH",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "Idempotency-Key": "offline-kitchen-stale",
      },
      body: JSON.stringify({ expectedVersion: 99 }),
    });
    assert.equal(staleVersion.status, 409);
    assert.equal(
      ((await staleVersion.json()) as { error: { code: string } }).error.code,
      "OFFLINE_KITCHEN_MUTATION_UNSAFE",
    );

    const missingVersion = await fetch(`${kitchenPath}/ticket-rebase/accept`, {
      method: "PATCH",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "Idempotency-Key": "offline-kitchen-no-version",
      },
      body: JSON.stringify({}),
    });
    assert.equal(missingVersion.status, 409);

    const missingTicket = await fetch(
      `${kitchenPath}/ticket-not-cached/accept`,
      {
        method: "PATCH",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": "offline-kitchen-missing-ticket",
        },
        body: JSON.stringify({ expectedVersion: 5 }),
      },
    );
    assert.equal(missingTicket.status, 409);

    const crossBranchTicket = await fetch(
      `${kitchenPath}/ticket-other-branch/accept`,
      {
        method: "PATCH",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": "offline-kitchen-cross-branch",
        },
        body: JSON.stringify({ expectedVersion: 5 }),
      },
    );
    assert.equal(crossBranchTicket.status, 409);

    for (const [index, action] of ["accept", "start", "ready"].entries()) {
      const queued = await fetch(`${kitchenPath}/ticket-rebase/${action}`, {
        method: "PATCH",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": `offline-kitchen-rebase-${index}`,
        },
        body: JSON.stringify({ expectedVersion: 5 + index }),
      });
      assert.equal(queued.status, 202);
    }

    const projected = await fetch(kitchenPath, {
      headers: { Authorization: authorization },
    });
    assert.equal(projected.status, 200);
    assert.equal(
      projected.headers.get("x-mazetto-desktop"),
      "offline-optimistic",
    );
    const projectedBody = (await projected.json()) as {
      data: Array<Record<string, unknown>>;
    };
    assert.equal(projectedBody.data[0]?.status, "READY");
    assert.equal(projectedBody.data[0]?.version, 8);
    assert.equal(projectedBody.data[0]?.pendingSync, true);

    online = true;
    const reconnecting = await fetch(
      `http://127.0.0.1:${port}/api/v1/branches`,
      { headers: { Authorization: authorization } },
    );
    assert.equal(reconnecting.status, 503);
    await waitFor(() => gateway.status().mode === "online");
    const recovered = await fetch(`http://127.0.0.1:${port}/api/v1/branches`, {
      headers: { Authorization: authorization },
    });
    assert.equal(recovered.status, 200);
    await waitFor(() => sent.length === 3, 3_000);
    await waitFor(() => store.summary().pendingCommands === 0);
    assert.deepEqual(sent, [
      { action: "accept", expectedVersion: 5 },
      { action: "start", expectedVersion: 11 },
      { action: "ready", expectedVersion: 12 },
    ]);

    online = false;
    const reconciled = await fetch(kitchenPath, {
      headers: { Authorization: authorization },
    });
    assert.equal(reconciled.status, 200);
    assert.equal(reconciled.headers.get("x-mazetto-desktop"), "offline-cache");
    const reconciledBody = (await reconciled.json()) as {
      data: Array<Record<string, unknown>>;
    };
    assert.equal(reconciledBody.data[0]?.status, "READY");
    assert.equal(reconciledBody.data[0]?.version, 13);
    assert.equal(reconciledBody.data[0]?.pendingSync, undefined);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline register shifts keep local IDs, project state, and replay in branch order", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-offline-shifts-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("offline-shifts", "branch-1");
  const sent: string[] = [];
  let online = true;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input, init) => {
      if (!online) throw new Error("offline");
      const url = new URL(String(input));
      if (url.pathname.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }
      if (
        init?.method === "GET" &&
        [
          "/api/v1/cash-register/shift",
          "/api/v1/cash-register/courier-shift",
        ].includes(url.pathname)
      ) {
        return jsonResponse({ success: true, data: null });
      }
      if (init?.method === "POST") {
        sent.push(url.pathname);
        if (url.pathname === "/api/v1/cash-register/shift/open") {
          return jsonResponse({
            success: true,
            data: {
              id: "server-shift-17",
              shiftNumber: 17,
              status: "OPEN",
              openingBalance: "25000",
              openedAt: "2026-10-01T08:00:00.000Z",
            },
          });
        }
        if (url.pathname === "/api/v1/cash-register/courier-shift/open") {
          return jsonResponse({
            success: true,
            data: {
              id: "server-courier-shift-4",
              shiftNumber: 4,
              status: "OPEN",
              currentCash: "0",
              openedAt: "2026-10-01T08:01:00.000Z",
            },
          });
        }
        if (
          url.pathname === "/api/v1/cash-register/shift/server-shift-17/close"
        ) {
          return jsonResponse({
            success: true,
            data: {
              id: "server-shift-17",
              shiftNumber: 17,
              status: "CLOSED",
            },
          });
        }
        return jsonResponse({ success: false }, 404);
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    const headers = {
      Authorization: authorization,
      "Content-Type": "application/json",
    };
    const shiftPath = `http://127.0.0.1:${port}/api/v1/cash-register/shift`;
    const courierShiftPath = `http://127.0.0.1:${port}/api/v1/cash-register/courier-shift`;
    online = false;

    const openedResponse = await fetch(`${shiftPath}/open`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "offline-register-open" },
      body: JSON.stringify({ openingBalance: 25_000 }),
    });
    assert.equal(openedResponse.status, 202);
    const openedPayload = (await openedResponse.json()) as {
      data: { id: string; pendingSync: boolean };
    };
    const localShiftId = openedPayload.data.id;
    assert.match(localShiftId, /^local-/);
    assert.equal(openedPayload.data.pendingSync, true);

    const openProjection = await fetch(shiftPath, {
      headers: { Authorization: authorization },
    });
    const openData = (await openProjection.json()) as {
      data: Record<string, unknown>;
    };
    assert.equal(openData.data.id, localShiftId);
    assert.equal(openData.data.status, "OPEN");
    assert.equal(openData.data.pendingSync, true);

    const courierOpenedResponse = await fetch(`${courierShiftPath}/open`, {
      method: "POST",
      headers: {
        ...headers,
        "Idempotency-Key": "offline-courier-shift-open",
      },
      body: JSON.stringify({ openingBalance: 0 }),
    });
    assert.equal(courierOpenedResponse.status, 202);
    const courierOpenedPayload = (await courierOpenedResponse.json()) as {
      data: { id: string };
    };
    assert.match(courierOpenedPayload.data.id, /^local-/);

    const courierProjection = await fetch(courierShiftPath, {
      headers: { Authorization: authorization },
    });
    const courierData = (await courierProjection.json()) as {
      data: Record<string, unknown>;
    };
    assert.equal(courierData.data.id, courierOpenedPayload.data.id);
    assert.equal(courierData.data.pendingSync, true);

    const closedResponse = await fetch(`${shiftPath}/${localShiftId}/close`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "offline-register-close" },
      body: JSON.stringify({ closingBalance: 30_000 }),
    });
    assert.equal(closedResponse.status, 202);
    const closedPayload = (await closedResponse.json()) as {
      data: { status: string; pendingSync: boolean };
    };
    assert.equal(closedPayload.data.status, "CLOSED");
    assert.equal(closedPayload.data.pendingSync, true);

    const closedProjection = await fetch(shiftPath, {
      headers: { Authorization: authorization },
    });
    assert.equal(
      ((await closedProjection.json()) as { data: unknown }).data,
      null,
    );

    online = true;
    const reconnecting = await fetch(
      `http://127.0.0.1:${port}/api/v1/branches`,
      { headers: { Authorization: authorization } },
    );
    assert.equal(reconnecting.status, 503);
    await waitFor(() => gateway.status().mode === "online");
    await waitFor(() => sent.length === 3, 3_000);
    await waitFor(() => store.summary().pendingCommands === 0);
    assert.deepEqual(sent, [
      "/api/v1/cash-register/shift/open",
      "/api/v1/cash-register/courier-shift/open",
      "/api/v1/cash-register/shift/server-shift-17/close",
    ]);

    online = false;
    const finalShift = await fetch(shiftPath, {
      headers: { Authorization: authorization },
    });
    assert.equal(finalShift.headers.get("x-mazetto-desktop"), "offline-cache");
    assert.equal(((await finalShift.json()) as { data: unknown }).data, null);
    const finalCourierShift = await fetch(courierShiftPath, {
      headers: { Authorization: authorization },
    });
    const finalCourierData = (await finalCourierShift.json()) as {
      data: Record<string, unknown>;
    };
    assert.equal(
      finalCourierShift.headers.get("x-mazetto-desktop"),
      "offline-cache",
    );
    assert.equal(finalCourierData.data.id, "server-courier-shift-4");
    assert.equal(finalCourierData.data.pendingSync, undefined);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline cash transactions update the shift balance and survive acknowledgement", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-offline-cash-transactions-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-offline", "branch-1");
  const sent: Array<{ path: string; body: Record<string, unknown> }> = [];
  let online = true;
  let serverShift: Record<string, unknown> | null = null;
  let transactionNumber = 0;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input, init) => {
      if (!online) throw new Error("offline");
      const url = new URL(String(input));
      if (url.pathname.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }
      if (
        init?.method === "GET" &&
        url.pathname === "/api/v1/cash-register/shift"
      ) {
        return jsonResponse({ success: true, data: serverShift });
      }
      if (
        init?.method === "POST" &&
        url.pathname === "/api/v1/cash-register/shift/open"
      ) {
        const body = JSON.parse(String(init.body)) as {
          openingBalance: number;
        };
        serverShift = {
          id: "server-shift-cash-1",
          status: "OPEN",
          openingBalance: String(body.openingBalance),
          currentBalance: String(body.openingBalance),
          expectedCash: String(body.openingBalance),
          cashTransactions: [],
        };
        sent.push({ path: url.pathname, body });
        return jsonResponse({ success: true, data: serverShift });
      }
      if (
        init?.method === "POST" &&
        /^\/api\/v1\/cash-register\/shift\/server-shift-cash-1\/transactions$/.test(
          url.pathname,
        )
      ) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        sent.push({ path: url.pathname, body });
        const amount = Number(body.amount);
        const type = String(body.type);
        const outgoing = ["REFUND", "EXPENSE", "WITHDRAW", "CASH_OUT"].includes(
          type,
        );
        const transaction = {
          id: `server-cash-${++transactionNumber}`,
          shiftId: "server-shift-cash-1",
          type,
          amount: String(amount),
          reason: body.reason ?? null,
          occurredAt: `2026-10-01T10:0${transactionNumber}:00.000Z`,
        };
        const cashTransactions = [
          transaction,
          ...((serverShift?.cashTransactions as unknown[]) ?? []),
        ];
        const currentBalance =
          Number(serverShift?.currentBalance ?? 0) +
          (outgoing ? -amount : amount);
        serverShift = {
          ...serverShift,
          cashTransactions,
          currentBalance: String(currentBalance),
          expectedCash: String(currentBalance),
        };
        return jsonResponse({ success: true, data: transaction });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    const headers = {
      Authorization: authorization,
      "Content-Type": "application/json",
    };
    const shiftUrl = `http://127.0.0.1:${port}/api/v1/cash-register/shift`;
    assert.equal(
      (await fetch(shiftUrl, { headers: { Authorization: authorization } }))
        .status,
      200,
    );

    online = false;
    const openResponse = await fetch(`${shiftUrl}/open`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "cash-offline-open" },
      body: JSON.stringify({ openingBalance: 25_000 }),
    });
    assert.equal(openResponse.status, 202);
    const opened = (await openResponse.json()) as { data: { id: string } };
    assert.match(opened.data.id, /^local-/);

    const overspendOpeningFloat = await fetch(
      `${shiftUrl}/${opened.data.id}/transactions`,
      {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": "cash-offline-overdraw-open" },
        body: JSON.stringify({ type: "EXPENSE", amount: 25_001 }),
      },
    );
    assert.equal(overspendOpeningFloat.status, 409);
    assert.match(
      (await overspendOpeningFloat.json()).error.message,
      /Joriy qoldiq: 25000\.00 so'm/,
    );
    assert.equal(store.summary().pendingCommands, 1);

    const expenseRequest = {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "cash-offline-expense" },
      body: JSON.stringify({ type: "EXPENSE", amount: 3_750, reason: "Xarid" }),
    };
    const expenseResponse = await fetch(
      `${shiftUrl}/${opened.data.id}/transactions`,
      expenseRequest,
    );
    assert.equal(expenseResponse.status, 202);
    const queuedExpense = (await expenseResponse.json()) as {
      data: { id: string; pendingSync: boolean; commandId: string };
    };
    assert.equal(queuedExpense.data.pendingSync, true);
    const duplicate = await fetch(
      `${shiftUrl}/${opened.data.id}/transactions`,
      expenseRequest,
    );
    assert.equal(duplicate.status, 202);
    assert.equal(
      ((await duplicate.json()) as { data: { commandId: string } }).data
        .commandId,
      queuedExpense.data.commandId,
    );

    const overspendAfterQueuedExpense = await fetch(
      `${shiftUrl}/${opened.data.id}/transactions`,
      {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": "cash-offline-overdraw-after-expense" },
        body: JSON.stringify({ type: "WITHDRAW", amount: 21_251 }),
      },
    );
    assert.equal(overspendAfterQueuedExpense.status, 409);
    assert.match(
      (await overspendAfterQueuedExpense.json()).error.message,
      /Joriy qoldiq: 21250\.00 so'm/,
    );
    assert.equal(store.summary().pendingCommands, 2);

    const incomeResponse = await fetch(
      `${shiftUrl}/${opened.data.id}/transactions`,
      {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": "cash-offline-income" },
        body: JSON.stringify({ type: "INCOME", amount: 250, reason: "Qaytim" }),
      },
    );
    assert.equal(incomeResponse.status, 202);
    assert.equal(store.summary().pendingCommands, 3);

    const optimistic = await fetch(shiftUrl, {
      headers: { Authorization: authorization },
    });
    assert.equal(
      optimistic.headers.get("x-mazetto-desktop"),
      "offline-optimistic",
    );
    const projected = (await optimistic.json()) as {
      data: Record<string, unknown> & {
        cashTransactions: Array<Record<string, unknown>>;
      };
    };
    assert.equal(projected.data.id, opened.data.id);
    assert.equal(projected.data.expectedCash, "21500");
    assert.equal(projected.data.cashTransactions.length, 2);
    assert.equal(projected.data.cashTransactions[0]?.type, "INCOME");
    assert.equal(projected.data.cashTransactions[1]?.pendingSync, true);

    online = true;
    const reconnecting = await fetch(
      `http://127.0.0.1:${port}/api/v1/branches`,
      {
        headers: { Authorization: authorization },
      },
    );
    assert.equal(reconnecting.status, 503);
    await waitFor(() => gateway.status().mode === "online");
    await waitFor(() => sent.length === 3, 3_000);
    await waitFor(() => store.summary().pendingCommands === 0);
    assert.deepEqual(
      sent.slice(1).map((item) => [item.body.type, item.body.amount]),
      [
        ["EXPENSE", 3_750],
        ["INCOME", 250],
      ],
    );
    assert.equal(
      serverShift?.expectedCash,
      "21500",
      JSON.stringify(serverShift),
    );
    assert.deepEqual(
      sent.map((item) => item.path),
      [
        "/api/v1/cash-register/shift/open",
        "/api/v1/cash-register/shift/server-shift-cash-1/transactions",
        "/api/v1/cash-register/shift/server-shift-cash-1/transactions",
      ],
    );
    assert.equal(sent[1]?.body.reason, "Xarid");
    assert.equal(sent[2]?.body.reason, "Qaytim");

    online = false;
    const reconciled = await fetch(shiftUrl, {
      headers: { Authorization: authorization },
    });
    assert.equal(reconciled.headers.get("x-mazetto-desktop"), "offline-cache");
    const finalShift = (await reconciled.json()) as {
      data: Record<string, unknown> & {
        cashTransactions: Array<Record<string, unknown>>;
      };
    };
    assert.equal(finalShift.data.id, "server-shift-cash-1");
    assert.equal(finalShift.data.expectedCash, "21500");
    assert.equal(finalShift.data.cashTransactions.length, 2);
    assert.deepEqual(
      finalShift.data.cashTransactions
        .map((transaction) => transaction.id)
        .sort(),
      ["server-cash-1", "server-cash-2"],
    );
    assert.equal(finalShift.data.pendingSync, undefined);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline cash transfers debit the shift once, enforce the cached balance, and reconcile", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-offline-cash-transfers-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-transfer", "branch-1");
  const sent: Array<{ amount: number; idempotencyKey: string | null }> = [];
  let online = true;
  let transferNumber = 0;
  let serverShift: Record<string, unknown> = {
    id: "server-shift-transfer-1",
    status: "OPEN",
    openingBalance: "12000",
    currentBalance: "12000",
    expectedCash: "12000",
    cashTransactions: [],
    outgoingCashTransfers: [],
  };
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 25,
    fetchImpl: async (input, init) => {
      if (!online) throw new Error("offline");
      const url = new URL(String(input));
      if (url.pathname.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }
      if (
        init?.method === "GET" &&
        url.pathname === "/api/v1/cash-register/shift"
      ) {
        return jsonResponse({ success: true, data: serverShift });
      }
      if (
        init?.method === "GET" &&
        url.pathname === "/api/v1/cash-register/transfers/receivers"
      ) {
        return jsonResponse({
          success: true,
          data: [{ shiftId: "receiver-shift-1", employeeId: "cashier-2" }],
        });
      }
      if (
        init?.method === "POST" &&
        url.pathname === "/api/v1/cash-register/transfers"
      ) {
        const body = JSON.parse(String(init.body)) as {
          amount: number;
          toShiftId: string;
        };
        const idempotencyKey = new Headers(init.headers).get("idempotency-key");
        sent.push({ amount: body.amount, idempotencyKey });
        transferNumber++;
        const id = `server-transfer-${transferNumber}`;
        const amount = Number(body.amount);
        const nextBalance = Number(serverShift.expectedCash) - amount;
        const transfer = {
          id,
          fromShiftId: "server-shift-transfer-1",
          toShiftId: body.toShiftId,
          amount: String(amount),
          status: "PENDING",
          createdAt: `2026-10-01T10:0${transferNumber}:00.000Z`,
        };
        serverShift = {
          ...serverShift,
          currentBalance: String(nextBalance),
          expectedCash: String(nextBalance),
          cashTransactions: [
            {
              id: `server-ledger-${transferNumber}`,
              shiftId: "server-shift-transfer-1",
              cashTransferId: id,
              type: "CASH_OUT",
              amount: String(amount),
              reason: "Cash transfer to cashier",
            },
            ...(serverShift.cashTransactions as unknown[]),
          ],
          outgoingCashTransfers: [
            transfer,
            ...(serverShift.outgoingCashTransfers as unknown[]),
          ],
        };
        return jsonResponse({ success: true, data: transfer });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    const baseUrl = `http://127.0.0.1:${port}/api/v1/cash-register`;
    const headers = {
      Authorization: authorization,
      "Content-Type": "application/json",
    };
    assert.equal(
      (
        await fetch(`${baseUrl}/shift`, {
          headers: { Authorization: authorization },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/transfers/receivers`, {
          headers: { Authorization: authorization },
        })
      ).status,
      200,
    );
    online = false;
    await waitFor(() => gateway.status().mode === "offline");

    const firstRequest = {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "offline-transfer-1" },
      body: JSON.stringify({ amount: 5_000, toShiftId: "receiver-shift-1" }),
    };
    const first = await fetch(`${baseUrl}/transfers`, firstRequest);
    assert.equal(first.status, 202, await first.clone().text());
    const firstData = (await first.json()) as {
      data: { commandId: string; pendingSync: boolean };
    };
    assert.equal(firstData.data.pendingSync, true);
    const duplicate = await fetch(`${baseUrl}/transfers`, firstRequest);
    assert.equal(duplicate.status, 202);
    assert.equal(
      ((await duplicate.json()) as { data: { commandId: string } }).data
        .commandId,
      firstData.data.commandId,
    );
    const staleReceiver = await fetch(`${baseUrl}/transfers`, {
      method: "POST",
      headers: {
        ...headers,
        "Idempotency-Key": "offline-transfer-stale-receiver",
      },
      body: JSON.stringify({ amount: 500, toShiftId: "closed-receiver-shift" }),
    });
    assert.equal(staleReceiver.status, 409);
    assert.match(await staleReceiver.text(), /ochiq smenasi.*topilmadi/i);

    const second = await fetch(`${baseUrl}/transfers`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "offline-transfer-2" },
      body: JSON.stringify({ amount: 2_000, toShiftId: "receiver-shift-1" }),
    });
    assert.equal(second.status, 202);
    const overdraw = await fetch(`${baseUrl}/transfers`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "offline-transfer-overdraw" },
      body: JSON.stringify({ amount: 6_000, toShiftId: "receiver-shift-1" }),
    });
    assert.equal(overdraw.status, 409);
    assert.match(await overdraw.text(), /mavjud naqd puldan oshib/);

    const accept = await fetch(
      `${baseUrl}/transfers/server-transfer-1/accept`,
      {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": "offline-transfer-accept" },
      },
    );
    assert.equal(accept.status, 503);
    assert.match(await accept.text(), /ikki kassa holatini tekshirmasdan/i);
    assert.equal(store.summary().pendingCommands, 2);
    const close = await fetch(
      `${baseUrl}/shift/server-shift-transfer-1/close`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Idempotency-Key": "offline-close-with-pending-transfer",
        },
        body: JSON.stringify({ closingBalance: 5_000 }),
      },
    );
    assert.equal(close.status, 409);
    assert.match(await close.text(), /oldin pul topshiruvi qabul qilinishi/i);
    assert.equal(store.summary().pendingCommands, 2);

    const projected = await fetch(`${baseUrl}/shift`, {
      headers: { Authorization: authorization },
    });
    const projectedData = (await projected.json()) as {
      data: {
        expectedCash: string;
        cashTransactions: Array<Record<string, unknown>>;
        outgoingCashTransfers: Array<Record<string, unknown>>;
      };
    };
    assert.equal(projectedData.data.expectedCash, "5000");
    assert.equal(projectedData.data.cashTransactions.length, 2);
    assert.equal(projectedData.data.outgoingCashTransfers.length, 2);
    assert.ok(
      projectedData.data.outgoingCashTransfers.every(
        (item) => item.pendingSync,
      ),
    );

    online = true;
    const reconnect = await fetch(`http://127.0.0.1:${port}/api/v1/branches`, {
      headers: { Authorization: authorization },
    });
    assert.equal(reconnect.status, 503);
    await waitFor(() => gateway.status().mode === "online");
    await waitFor(() => store.summary().pendingCommands === 0);
    assert.deepEqual(sent, [
      { amount: 5_000, idempotencyKey: "offline-transfer-1" },
      { amount: 2_000, idempotencyKey: "offline-transfer-2" },
    ]);
    assert.equal(serverShift.expectedCash, "5000");

    online = false;
    const reconciled = await fetch(`${baseUrl}/shift`, {
      headers: { Authorization: authorization },
    });
    const reconciledData = (await reconciled.json()) as {
      data: {
        expectedCash: string;
        cashTransactions: Array<Record<string, unknown>>;
        outgoingCashTransfers: Array<Record<string, unknown>>;
      };
    };
    assert.equal(reconciledData.data.expectedCash, "5000");
    assert.deepEqual(
      reconciledData.data.cashTransactions
        .map((item) => item.cashTransferId)
        .sort(),
      ["server-transfer-1", "server-transfer-2"],
    );
    assert.deepEqual(
      reconciledData.data.outgoingCashTransfers.map((item) => item.id).sort(),
      ["server-transfer-1", "server-transfer-2"],
    );
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("an unresolved earlier command blocks later writes to the same aggregate only", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-order-sequence-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const base = {
    commandType: "order.items.update",
    aggregateType: "orders",
    actorId: "waiter-a",
    branchId: "branch-1",
    authScope: "waiter-a:branch-1",
    payload: {
      method: "POST",
      pathname: "/api/v1/orders/order-a/items",
      body: "{}",
    },
  };
  const first = store.enqueueMutation({
    ...base,
    idempotencyKey: "order-a-first",
    aggregateId: "order-a",
  });
  const second = store.enqueueMutation({
    ...base,
    idempotencyKey: "order-a-second",
    aggregateId: "order-a",
  });
  const otherOrder = store.enqueueMutation({
    ...base,
    idempotencyKey: "order-b-first",
    aggregateId: "order-b",
  });

  try {
    store.markMutationConflict(first.id, "version conflict needs review");
    assert.deepEqual(
      store.dueMutations("waiter-a:branch-1", 10).map((item) => item.id),
      [otherOrder.id],
    );
    assert.equal(store.getOutboxCommand(second.id)?.aggregateId, "order-a");
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline courier status projection rebases versions and reconciles the active list", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-courier-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("courier-offline", "branch-1");
  const cacheScope = DesktopStore.authScope(authorization);
  const requestUrl =
    "https://api.example.test/api/v1/courier/orders?limit=100&offset=0";
  const initialOrder = {
    id: "customer-order-101",
    type: "DELIVERY",
    status: "READY",
    branch: { id: "branch-1" },
    order: {
      id: "order-101",
      status: "READY",
      version: 7,
      outstandingAmount: "0",
    },
  };
  store.putCachedResponse({
    cacheKey: DesktopStore.cacheKey(requestUrl, cacheScope),
    requestUrl,
    authScope: cacheScope,
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ success: true, data: [initialOrder] }),
    cachedAt: new Date().toISOString(),
  });
  let online = false;
  const replayed: Array<{ status: string; expectedVersion: number }> = [];
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 60_000,
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/health") {
        return online
          ? jsonResponse({ ok: true })
          : jsonResponse({ ok: false }, 503);
      }
      if (url.pathname.endsWith("/courier/orders/customer-order-101/status")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          status: string;
          expectedVersion: number;
        };
        replayed.push(body);
        return jsonResponse({
          success: true,
          data: {
            ...initialOrder,
            status: body.status === "SERVED" ? "READY" : body.status,
            order: {
              ...initialOrder.order,
              status: body.status,
              version: body.expectedVersion + 1,
            },
          },
        });
      }
      return online
        ? jsonResponse({ success: true, data: [] })
        : jsonResponse({ success: false }, 503);
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "offline");
    const baseUrl = "http://127.0.0.1:" + port;
    const update = (status: string, expectedVersion: number, key: string) =>
      fetch(baseUrl + "/api/v1/courier/orders/customer-order-101/status", {
        method: "PATCH",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ status, expectedVersion }),
      });

    const served = await update("SERVED", 7, "courier-served-offline");
    assert.equal(served.status, 202);
    const afterServed = await fetch(
      baseUrl + "/api/v1/courier/orders?limit=100&offset=0",
      {
        headers: { Authorization: authorization },
      },
    );
    assert.equal(
      afterServed.headers.get("x-mazetto-desktop"),
      "offline-optimistic",
    );
    const servedData = (await afterServed.json()) as {
      data: Array<{
        status: string;
        pendingSync: boolean;
        order: { status: string; version: number; pendingSync: boolean };
      }>;
    };
    assert.equal(servedData.data[0]?.status, "READY");
    assert.equal(servedData.data[0]?.order.status, "SERVED");
    assert.equal(servedData.data[0]?.order.version, 8);
    assert.equal(servedData.data[0]?.pendingSync, true);
    assert.equal(servedData.data[0]?.order.pendingSync, true);

    const completed = await update("COMPLETED", 8, "courier-completed-offline");
    assert.equal(completed.status, 202);
    const afterCompleted = await fetch(
      baseUrl + "/api/v1/courier/orders?limit=100&offset=0",
      {
        headers: { Authorization: authorization },
      },
    );
    assert.deepEqual((await afterCompleted.json()).data, []);

    online = true;
    await waitFor(() => gateway.status().mode === "online");
    await waitFor(() => store.summary().pendingCommands === 0, 3_000);
    assert.deepEqual(replayed, [
      { status: "SERVED", expectedVersion: 7 },
      { status: "COMPLETED", expectedVersion: 8 },
    ]);
    const reconciled = store.getLatestCachedResponse(
      cacheScope,
      "/api/v1/courier/orders",
    );
    assert.ok(reconciled);
    assert.deepEqual(JSON.parse(reconciled.body).data, []);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline courier completion with an unpaid balance is rejected before queueing", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-courier-cash-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("courier-cash-offline", "branch-1");
  const cacheScope = DesktopStore.authScope(authorization);
  const requestUrl =
    "https://api.example.test/api/v1/courier/orders?limit=100&offset=0";
  store.putCachedResponse({
    cacheKey: DesktopStore.cacheKey(requestUrl, cacheScope),
    requestUrl,
    authScope: cacheScope,
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      success: true,
      data: [
        {
          id: "customer-order-202",
          type: "DELIVERY",
          status: "SERVED",
          branch: { id: "branch-1" },
          order: {
            id: "order-202",
            status: "SERVED",
            version: 11,
            outstandingAmount: "18000",
          },
        },
      ],
    }),
    cachedAt: new Date().toISOString(),
  });
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 60_000,
    fetchImpl: async () => jsonResponse({ ok: false }, 503),
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "offline");
    const response = await fetch(
      "http://127.0.0.1:" +
        port +
        "/api/v1/courier/orders/customer-order-202/status",
      {
        method: "PATCH",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": "courier-cash-offline",
        },
        body: JSON.stringify({
          status: "COMPLETED",
          expectedVersion: 11,
          amount: 18_000,
          paymentMethodCode: "CASH",
          shiftId: "courier-shift-1",
        }),
      },
    );
    assert.equal(response.status, 409);
    const payload = (await response.json()) as {
      error: { code: string; message: string };
    };
    assert.equal(payload.error.code, "OFFLINE_COURIER_MUTATION_UNSAFE");
    assert.match(payload.error.message, /naqd qoldiq/i);
    assert.equal(store.summary().pendingCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline courier updates reject cross-branch and stale cached orders", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-courier-scope-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("courier-scope", "branch-1");
  const cacheScope = DesktopStore.authScope(authorization);
  const requestUrl = "https://api.example.test/api/v1/courier/orders?limit=100";
  const saveOrder = (branchId: string, version: number) => {
    const body = JSON.stringify({
      success: true,
      data: [
        {
          id: "customer-order-303",
          type: "DELIVERY",
          status: "READY",
          branch: { id: branchId },
          order: {
            id: "order-303",
            status: "READY",
            version,
            outstandingAmount: "0",
          },
        },
      ],
    });
    store.putCachedResponse({
      cacheKey: DesktopStore.cacheKey(requestUrl, cacheScope),
      requestUrl,
      authScope: cacheScope,
      status: 200,
      contentType: "application/json; charset=utf-8",
      body,
      cachedAt: new Date().toISOString(),
    });
  };
  saveOrder("branch-2", 12);
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 60_000,
    fetchImpl: async () => jsonResponse({ ok: false }, 503),
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "offline");
    const send = () =>
      fetch(
        "http://127.0.0.1:" +
          port +
          "/api/v1/courier/orders/customer-order-303/status",
        {
          method: "PATCH",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
            "Idempotency-Key": "courier-scope-check",
          },
          body: JSON.stringify({ status: "SERVED", expectedVersion: 12 }),
        },
      );
    const wrongBranch = await send();
    assert.equal(wrongBranch.status, 409);
    assert.match((await wrongBranch.json()).error.message, /filial/i);

    saveOrder("branch-1", 11);
    const staleVersion = await send();
    assert.equal(staleVersion.status, 409);
    assert.match((await staleVersion.json()).error.message, /versiya/i);
    assert.equal(store.summary().pendingCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("waiter order status and acceptance queue with branch/version guards and replay online", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-waiter-status-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("waiter-status", "branch-1");
  let online = true;
  const serverOrders = new Map<string, { version: number; status: string }>([
    ["order-served", { version: 4, status: "NEW" }],
    ["order-confirmed", { version: 2, status: "NEW" }],
    ["order-accepted", { version: 8, status: "NEW" }],
  ]);
  const replayed: Array<{ path: string; version: number; key: string | null }> =
    [];
  const table = {
    id: "table-1",
    branchId: "branch-1",
    name: "1-stol",
    status: "OCCUPIED",
    orders: [
      {
        id: "order-served",
        branchId: "branch-1",
        version: 4,
        status: "NEW",
        items: [],
      },
      {
        id: "order-confirmed",
        branchId: "branch-1",
        version: 2,
        status: "NEW",
        items: [],
      },
      {
        id: "order-accepted",
        branchId: "branch-1",
        version: 8,
        status: "NEW",
        items: [],
      },
    ],
  };
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    probeIntervalMs: 25,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/health"))
        return jsonResponse({ success: true });
      if (!online) throw new Error("offline");
      if (url.pathname === "/api/v1/realtime/bootstrap") {
        return jsonResponse({
          success: true,
          data: {
            schemaVersion: 2,
            generatedAt: new Date().toISOString(),
            branchId: "branch-1",
            menu: { categories: [], products: [] },
            tables: [table],
          },
        });
      }
      if (url.pathname === "/api/v1/tables/table-1") {
        return jsonResponse({ success: true, data: table });
      }
      const statusMatch = url.pathname.match(
        /^\/api\/v1\/orders\/([^/]+)\/status$/,
      );
      const acceptMatch = url.pathname.match(
        /^\/api\/v1\/orders\/([^/]+)\/actions\/accept$/,
      );
      const orderId = statusMatch?.[1] ?? acceptMatch?.[1];
      if (orderId && (init?.method === "PATCH" || init?.method === "POST")) {
        const body = JSON.parse(String(init.body ?? "{}")) as {
          expectedVersion?: number;
          status?: string;
        };
        const order = serverOrders.get(orderId);
        if (!order || body.expectedVersion !== order.version) {
          return jsonResponse(
            { success: false, error: { message: "version conflict" } },
            409,
          );
        }
        const headers = new Headers(init.headers);
        replayed.push({
          path: url.pathname,
          version: body.expectedVersion,
          key: headers.get("idempotency-key"),
        });
        order.version += 1;
        order.status = acceptMatch?.[1]
          ? "CONFIRMED"
          : (body.status ?? order.status);
        return jsonResponse({
          success: true,
          data: { id: orderId, version: order.version, status: order.status },
        });
      }
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    await waitFor(() => gateway.status().mode === "online");
    const request = (
      path: string,
      method = "GET",
      body?: Record<string, unknown>,
      key?: string,
    ) =>
      fetch("http://127.0.0.1:" + port + path, {
        method,
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    assert.equal(
      (await request("/api/v1/realtime/bootstrap?branchId=branch-1")).status,
      200,
    );
    assert.equal(
      (await request("/api/v1/tables/table-1?branchId=branch-1")).status,
      200,
    );

    online = false;
    const kitchen = await request(
      "/api/v1/orders/order-served/status",
      "PATCH",
      {
        status: "CONFIRMED",
        expectedVersion: 4,
        reason: "Oshxonaga yuborildi",
      },
      "waiter-confirmed-v4",
    );
    assert.equal(kitchen.status, 202);
    const served = await request(
      "/api/v1/orders/order-served/status",
      "PATCH",
      { status: "SERVED", expectedVersion: 5, reason: "Hisob so'raldi" },
      "waiter-served-v5",
    );
    assert.equal(served.status, 202);
    const confirmed = await request(
      "/api/v1/orders/order-confirmed/status",
      "PATCH",
      { status: "CONFIRMED", expectedVersion: 2 },
      "waiter-confirmed-v2",
    );
    assert.equal(confirmed.status, 202);
    const accepted = await request(
      "/api/v1/orders/order-accepted/actions/accept",
      "POST",
      { expectedVersion: 8 },
      "waiter-accept-v8",
    );
    assert.equal(accepted.status, 202);

    const invalidStatus = await request(
      "/api/v1/orders/order-served/status",
      "PATCH",
      { status: "CANCELLED", expectedVersion: 6 },
      "waiter-cancel-status",
    );
    assert.equal(invalidStatus.status, 409);
    const forced = await request(
      "/api/v1/orders/order-confirmed/status",
      "PATCH",
      { status: "SERVED", expectedVersion: 3, force: true },
      "waiter-force-status",
    );
    assert.equal(forced.status, 409);
    const stale = await request(
      "/api/v1/orders/order-confirmed/status",
      "PATCH",
      { status: "SERVED", expectedVersion: 2 },
      "waiter-stale-status",
    );
    assert.equal(stale.status, 409);
    const missingKey = await request(
      "/api/v1/orders/order-confirmed/status",
      "PATCH",
      { status: "SERVED", expectedVersion: 3 },
    );
    assert.equal(missingKey.status, 409);
    const foreign = await request(
      "/api/v1/orders/foreign-order/status",
      "PATCH",
      { status: "CONFIRMED", expectedVersion: 1 },
      "waiter-foreign-status",
    );
    assert.equal(foreign.status, 409);
    const cancel = await request(
      "/api/v1/orders/order-confirmed/actions/cancel",
      "POST",
      { expectedVersion: 3 },
      "waiter-cancel-action",
    );
    assert.equal(cancel.status, 503);
    assert.equal(store.summary().pendingCommands, 4);

    const projectedResponse = await request(
      "/api/v1/tables/table-1?branchId=branch-1",
    );
    const projected = (await projectedResponse.json()) as {
      data: {
        orders: Array<{
          id: string;
          version: number;
          status: string;
          pendingSync?: boolean;
        }>;
      };
    };
    const projectedOrders = new Map(
      projected.data.orders.map((order) => [order.id, order]),
    );
    assert.deepEqual(
      [
        projectedOrders.get("order-served")?.status,
        projectedOrders.get("order-served")?.version,
        projectedOrders.get("order-confirmed")?.status,
        projectedOrders.get("order-confirmed")?.version,
        projectedOrders.get("order-accepted")?.status,
        projectedOrders.get("order-accepted")?.version,
      ],
      ["SERVED", 6, "CONFIRMED", 3, "CONFIRMED", 9],
    );
    assert.equal(projectedOrders.get("order-served")?.pendingSync, true);

    online = true;
    await waitFor(
      () =>
        store.summary().pendingCommands === 0 &&
        store.summary().sendingCommands === 0,
      8000,
    );
    assert.equal(replayed.length, 4);
    assert.deepEqual(
      replayed.map((entry) => entry.version).sort((a, b) => a - b),
      [2, 4, 5, 8],
    );
    assert.ok(replayed.every((entry) => entry.key));
    assert.equal(store.summary().conflictCommands, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy queued order cancellation is conflicted instead of replayed", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "mazetto-gateway-order-cancel-"),
  );
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("waiter-legacy-cancel", "branch-1");
  const authScope = DesktopStore.mutationScope(authorization);
  store.enqueueMutation({
    idempotencyKey: "legacy-cancel-key",
    commandType: "order.action",
    aggregateType: "orders",
    aggregateId: "order-legacy",
    actorId: "waiter-legacy-cancel",
    branchId: "branch-1",
    authScope,
    payload: {
      commandType: "order.action",
      method: "POST",
      pathname: "/api/v1/orders/order-legacy/actions/cancel",
      targetUrl:
        "https://api.example.test/api/v1/orders/order-legacy/actions/cancel",
      headers: { "idempotency-key": "legacy-cancel-key" },
      body: JSON.stringify({ expectedVersion: 4, reason: "legacy" }),
    },
  });
  let cancellationRequests = 0;
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/health")) {
        return jsonResponse({ success: true, data: { ok: true } });
      }
      if (url.pathname.endsWith("/actions/cancel")) cancellationRequests += 1;
      return jsonResponse({ success: true, data: [] });
    },
  });

  try {
    const port = await gateway.start();
    const refresh = await fetch(
      "http://127.0.0.1:" + port + "/api/v1/branches",
      {
        headers: { Authorization: authorization },
      },
    );
    assert.equal(refresh.status, 200);
    await waitFor(() => store.summary().conflictCommands === 1);
    assert.equal(cancellationRequests, 0);
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("gateway queues branch-scoped shift reports once for configured local printers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-shift-report-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  store.setSetting(
    "system_printers",
    JSON.stringify([
      { name: "Report printer", roles: ["SHIFT_REPORT"] },
    ]),
  );
  const gateway = new DesktopGateway({
    host: "127.0.0.1",
    port: 0,
    upstreamApiUrl: "https://api.example.test/api/v1",
    store,
    probeIntervalMs: 60_000,
    fetchImpl: async () => jsonResponse({ success: true, data: null }),
  });
  const authorization = desktopJwt("cashier-report", "branch-1", {
    employeeId: "employee-1",
    permissions: ["SHIFT_CLOSE"],
  });
  const payload = {
    documentType: "SHIFT_REPORT",
    requestId: "report-request-1",
    branchId: "branch-1",
    shift: {
      id: "shift-1",
      shiftNumber: 5,
      employeeId: "employee-1",
      branch: { id: "branch-1", name: "Sergeli" },
    },
    orders: [
      {
        id: "order-1",
        status: "SERVED",
        total: "17000",
        items: [{ productName: "Lavash", quantity: "1" }],
      },
    ],
  };

  try {
    const port = await gateway.start();
    const url = "http://127.0.0.1:" + port + "/api/v1/desktop/prints/shift-report";
    const send = (token: string, body: unknown) =>
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const noPermission = await send(
      desktopJwt("cashier-without-shift-permission", "branch-1", {
        employeeId: "employee-1",
      }),
      { ...payload, requestId: "report-request-no-permission" },
    );
    assert.equal(noPermission.status, 403);
    assert.equal(store.summary().pendingPrintJobs, 0);

    const anotherEmployee = await send(
      desktopJwt("cashier-another-employee", "branch-1", {
        employeeId: "employee-2",
        permissions: ["SHIFT_CLOSE"],
      }),
      { ...payload, requestId: "report-request-another-employee" },
    );
    assert.equal(anotherEmployee.status, 403);
    assert.equal(store.summary().pendingPrintJobs, 0);

    const first = await send(authorization, payload);
    assert.equal(first.status, 202);
    assert.deepEqual((await first.json()).data, {
      queued: true,
      printerConfigured: true,
    });
    const duplicate = await send(authorization, payload);
    assert.equal(duplicate.status, 202);
    assert.equal(store.summary().pendingPrintJobs, 1);

    const otherBranch = await send(
      desktopJwt("cashier-other-branch", "branch-2"),
      { ...payload, requestId: "report-request-2" },
    );
    assert.equal(otherBranch.status, 403);
    assert.equal(store.summary().pendingPrintJobs, 1);

    const queued = store.claimLocalPrintJob(["SHIFT_REPORT"]);
    assert.ok(queued);
    assert.equal(queued.branchId, "branch-1");
    assert.equal(queued.documentType, "SHIFT_REPORT");

    store.setSetting("system_printers", "[]");
    const unconfigured = await send(
      authorization,
      { ...payload, requestId: "report-request-3" },
    );
    assert.equal(unconfigured.status, 200);
    assert.deepEqual((await unconfigured.json()).data, {
      queued: false,
      printerConfigured: false,
    });
  } finally {
    await gateway.stop();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
