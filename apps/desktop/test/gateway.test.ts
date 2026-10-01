import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DesktopGateway } from "../src/gateway.js";
import { DesktopStore } from "../src/store.js";

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
    response.writeHead(200, { "Content-Type": "application/json" });
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

test("gateway queues an upstream-unavailable cash sale only with a stable idempotency key", async () => {
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

    assert.equal(response.status, 202);
    assert.equal(response.headers.get("x-mazetto-desktop"), "offline-queued");
    assert.equal(store.summary().pendingCommands, 1);
    assert.equal(store.listOutbox()[0]?.idempotencyKey, "http-outage-sale-1");
    assert.equal(gateway.status().mode, "offline");
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
      catalog: {
        branchId: "branch-1",
        products: [
          {
            id: "product-1",
            name: "Lavash",
            variants: [{ id: "variant-1", name: "Katta" }],
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
    assert.match(saleData.order.orderNumber, /^POS-\d{8}-\d{6}-[A-F0-9]{8}$/);
    assert.equal(saleData.order.displayOrderNumber, 101);
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
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.url, "https://api.example.test/api/v1/pos/orders");
    assert.equal(sent[0]?.idempotencyKey, "sale-key-1");
    assert.match(sent[0]?.body ?? "", /sale-key-1/);
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
  const authorization = desktopJwt("cashier-offline-payment", "branch-1");
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
        idempotencyKey: "offline-cash-payment",
        payments: [{ paymentMethodCode: "CASH", amount: 42_000 }],
      }),
    });
    assert.equal(queued.status, 202);
    const payload = await queued.json();
    assert.equal(payload.data.offlineQueued, true);
    assert.equal(payload.data.order.paymentStatus, "PENDING_SYNC");
    assert.equal(payload.data.order.receipts.length, 0);
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
    const listed = await fetch(base + "/outbox");
    const queue = await listed.json();
    assert.equal(queue.data.printJobs[0].state, "dead_letter");
    assert.equal(queue.data.printJobs[0].lastError, "Printer offline");

    const retried = await fetch(base + "/prints/" + printJob.id + "/retry", {
      method: "POST",
    });
    assert.equal(retried.status, 200);
    const updated = await retried.json();
    assert.equal(updated.data.printJobs[0].state, "pending");
    assert.equal(updated.data.summary.pendingPrintJobs, 1);
    assert.equal(updated.data.summary.deadLetterPrintJobs, 0);
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
          payments: [{ paymentMethodCode: "CASH", amount: 11_000 }],
        }),
      },
    );
    assert.equal(sale.status, 202);

    const outbox = await fetch(
      `http://127.0.0.1:${gatewayPort}/desktop/outbox`,
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
      `http://127.0.0.1:${gatewayPort}/desktop/outbox/${commandId}/cancel`,
      { method: "POST" },
    );
    assert.equal(cancel.status, 200);
    assert.equal(store.summary().pendingCommands, 0);
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
      method: "POST",
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
      if (init?.method === "POST") {
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
test("gateway resolves local aggregate IDs before replaying dependents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-dependency", "branch-1");
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
        init?.method === "POST" &&
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
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "ACCEPTED", expectedVersion: 0 }),
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
      "POST https://api.example.test/api/v1/orders/server-order-1/status",
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
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "ACCEPTED", expectedVersion: 0 }),
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
  const command = store.enqueueMutation({
    idempotencyKey: "blocked-key",
    commandType: "POST /api/v1/pos/orders",
    aggregateType: "pos",
    actorId: "cashier-4",
    branchId: "branch-1",
    authScope: "scope-1",
    payload: {
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
      { method: "POST" },
    );
    assert.equal(retry.status, 200);
    assert.equal(store.summary().conflictCommands, 0);
    assert.equal(store.summary().pendingCommands, 1);
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
        command: { payload: { body: unknown } };
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
    sellingPrice: "12000.00",
    variants: [{ id: "variant-1", name: "Katta", sellingPrice: "15000.00" }],
    modifiers: [
      { modifier: { id: "extra-cheese", name: "Pishloq", price: "2000.00" } },
    ],
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
      if (init?.method === "GET" && url.endsWith("/tables?branchId=branch-1")) {
        return jsonResponse({ success: true, data: [table] });
      }
      if (init?.method === "GET" && url.endsWith("/tables/table-1")) {
        return jsonResponse({ success: true, data: table });
      }
      if (
        init?.method === "GET" &&
        url.endsWith("/menu/products?branchId=branch-1")
      ) {
        return jsonResponse({ success: true, data: [product] });
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
            data: { id: "server-order-1", version: 1, items: [{ id: "server-item-1" }] },
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
      "/api/v1/tables?branchId=branch-1",
      "/api/v1/tables/table-1",
      "/api/v1/menu/products?branchId=branch-1",
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

    const projected = await readDetail();
    assert.equal(projected.orders[0]?.version, 1);
    assert.equal(projected.orders[0]?.total, "34000.00");
    assert.equal(projected.orders[0]?.items[0]?.id, addedData.id);
    assert.equal(store.summary().pendingCommands, 2);

    online = true;
    await waitFor(() => gateway.status().mode === "online");
    const trigger = await fetch("http://127.0.0.1:" + port + "/api/v1/branches", {
      headers: { Authorization: authorization },
    });
    assert.equal(trigger.status, 200);
    await waitFor(() => store.summary().pendingCommands === 0, 3_000);
    assert.equal(sent.length, 2);
    assert.equal(sent[0]?.url, "https://api.example.test/api/v1/tables/table-1/orders");
    assert.equal(sent[0]?.key, "waiter-open-key");
    assert.equal(
      sent[1]?.url,
      "https://api.example.test/api/v1/orders/server-order-1/items",
    );
    assert.equal(sent[1]?.key, "waiter-item-key");
    assert.equal(JSON.parse(sent[1]?.body ?? "{}").expectedVersion, 0);
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
  let online = false;
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
            expectedVersion: 10,
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
              order: { id: "order-rebase" },
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
        const nextBalance =
          Number(serverShift.expectedCash) - amount;
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
      (await fetch(`${baseUrl}/transfers/receivers`, {
        headers: { Authorization: authorization },
      })).status,
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
      ((await duplicate.json()) as { data: { commandId: string } }).data.commandId,
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
