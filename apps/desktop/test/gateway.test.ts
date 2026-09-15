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
  let receivedDeviceId: string | undefined;
  const upstream = createServer((_request, response) => {
    receivedDeviceId = _request.headers["x-mazetto-device-id"] as
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

test("gateway queues POS sales offline and flushes them after reconnect", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-gateway-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  const authorization = desktopJwt("cashier-1", "branch-1");
  const sent: { url: string; idempotencyKey: string | null; body: string }[] = [];
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
    assert.match((await sale.json()).data.order.orderNumber, /^OFF-/);

    online = true;
    const onlineRequest = await fetch(
      `http://127.0.0.1:${gatewayPort}/api/v1/branches`,
      { headers: { Authorization: authorization } },
    );
    assert.equal(onlineRequest.status, 200);

    await waitFor(() => store.summary().pendingCommands === 0);
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
    await waitFor(() => store.summary().pendingCommands === 0, 1_000);
    assert.deepEqual(sent, [
      "POST https://api.example.test/api/v1/pos/orders",
    ]);
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
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
