import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchPublicDataWithRetry,
  logCatalogUpstreamEvent,
  safeCatalogRouteLabel,
} from "../lib/public-fetch.mjs";

test("retries transient HTTP failures and returns the successful attempt", async () => {
  let calls = 0;
  const result = await fetchPublicDataWithRetry(
    "https://api.example.test/menu",
    {},
    {
      retryDelayMs: 0,
      fetchImpl: async () =>
        new Response(++calls < 2 ? "temporary" : "ok", {
          status: calls < 2 ? 503 : 200,
        }),
    },
  );

  assert.equal(result.response.status, 200);
  assert.equal(result.attempts, 2);
  assert.equal(await result.response.text(), "ok");
});

test("retries a network failure but stops after the bounded attempt count", async () => {
  let calls = 0;
  const result = await fetchPublicDataWithRetry(
    "https://api.example.test/menu",
    {},
    {
      retryDelayMs: 0,
      maxAttempts: 3,
      fetchImpl: async () => {
        calls += 1;
        if (calls < 3) throw new TypeError("network unavailable");
        return new Response("ok", { status: 200 });
      },
    },
  );

  assert.equal(calls, 3);
  assert.equal(result.response.status, 200);
  assert.equal(result.attempts, 3);
});

test("retries transient internal server errors", async () => {
  let calls = 0;
  const result = await fetchPublicDataWithRetry(
    "https://api.example.test/menu",
    {},
    {
      retryDelayMs: 0,
      fetchImpl: async () =>
        new Response(++calls === 1 ? "temporary" : "ok", {
          status: calls === 1 ? 500 : 200,
        }),
    },
  );

  assert.equal(calls, 2);
  assert.equal(result.response.status, 200);
  assert.equal(result.attempts, 2);
});

test("does not retry non-transient responses such as authorization failures", async () => {
  let calls = 0;
  const result = await fetchPublicDataWithRetry(
    "https://api.example.test/menu",
    {},
    {
      retryDelayMs: 0,
      fetchImpl: async () => {
        calls += 1;
        return new Response("denied", { status: 403 });
      },
    },
  );

  assert.equal(calls, 1);
  assert.equal(result.response.status, 403);
  assert.equal(result.attempts, 1);
});

test("does not retry after the caller aborts", async () => {
  let calls = 0;
  const controller = new AbortController();
  controller.abort(new Error("caller cancelled"));

  await assert.rejects(
    fetchPublicDataWithRetry(
      "https://api.example.test/menu",
      { signal: controller.signal },
      {
        retryDelayMs: 0,
        fetchImpl: async () => {
          calls += 1;
          throw controller.signal.reason;
        },
      },
    ),
    /caller cancelled/,
  );
  assert.equal(calls, 1);
});

test("catalog diagnostics omit query text and product identifiers", () => {
  assert.equal(
    safeCatalogRouteLabel("/customer/menu/products/secret-id?search=private"),
    "/customer/menu/products/:id",
  );

  const originalWarn = console.warn;
  let log = "";
  console.warn = (value) => { log = value; };
  try {
    logCatalogUpstreamEvent({
      path: "/customer/menu/products/secret-id?search=private",
      status: 503,
      attempts: 3,
      elapsedMs: 843.4,
      reason: "TypeError token=secret",
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.match(log, /customer_catalog_upstream_failed/);
  assert.match(log, /"status":503/);
  assert.doesNotMatch(log, /secret-id|private/);
  assert.doesNotMatch(log, /token=secret/);
});
