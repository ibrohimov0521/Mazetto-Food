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
        : jsonResponse({ success: false, error: { message: "Service unavailable" } }, apiStatus);
    },
  });

  try {
    const port = await gateway.start();
    const url = `http://127.0.0.1:${port}/api/v1/branches`;
    const headers = { Authorization: desktopJwt("cashier-http-503", "branch-1") };
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
        : jsonResponse({ success: false, error: { message: "Gateway unavailable" } }, 503),
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
        : jsonResponse({ success: false, error: { message: "Gateway unavailable" } }, 503),
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
    assert.equal(response.headers.get("x-mazetto-desktop"), "offline-unavailable");
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
  const authScope = DesktopStore.authScope(authorization);
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

      if (init?.method === "POST") {
        sent.push({
          url,
          idempotencyKey: new Headers(init.headers).get("idempotency-key"),
          body: String(init.body ?? ""),
        });
        return jsonResponse({ success: true, data: { ok: true } });
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
          idempotencyKey: "sale-key-1",
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
  const authScope = DesktopStore.authScope(authorization);
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
  const authScope = DesktopStore.authScope(authorization);
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

function desktopJwt(userId: string, branchId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ id: userId, branchId, isGlobalScope: false }),
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
