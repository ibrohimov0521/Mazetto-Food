import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { fetchWithTransientRetry } from "./http-with-transient-retry.mjs";

async function withServer(handler, run) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
}

test("uses a fresh timeout when retrying a timed-out request", async () => {
  let requestCount = 0;

  await withServer((_request, response) => {
    requestCount += 1;
    if (requestCount === 1) {
      setTimeout(() => {
        if (!response.destroyed) response.end("late");
      }, 100);
      return;
    }
    response.end("ok");
  }, async (url) => {
    const response = await fetchWithTransientRetry(url, {}, {
      timeoutMs: 25,
      retryDelayMs: 0,
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
  });

  assert.equal(requestCount, 2);
});

test("retries transient HTTP responses", async () => {
  let requestCount = 0;

  await withServer((_request, response) => {
    requestCount += 1;
    response.statusCode = requestCount < 3 ? 503 : 200;
    response.end(requestCount < 3 ? "retry" : "ok");
  }, async (url) => {
    const response = await fetchWithTransientRetry(url, {}, {
      timeoutMs: 1000,
      retryDelayMs: 0,
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
  });

  assert.equal(requestCount, 3);
});

test("does not retry when the caller aborts", async () => {
  let requestCount = 0;
  const caller = new AbortController();

  await withServer((_request, response) => {
    requestCount += 1;
    caller.abort();
    response.end("late");
  }, async (url) => {
    await assert.rejects(
      fetchWithTransientRetry(url, { signal: caller.signal }, {
        timeoutMs: 1000,
        retryDelayMs: 0,
      }),
    );
  });

  assert.equal(requestCount, 1);
});
