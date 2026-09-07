import assert from "node:assert/strict";
import { apiFetch } from "../lib/api";

async function main() {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalTimeout = AbortSignal.timeout;
  let now = 1_000;
  let calls = 0;
  let fail = false;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { hostname: "localhost" } } });
  Date.now = () => now;
  globalThis.fetch = async (_input, init) => {
    calls++;
    const headers = new Headers(init?.headers);
    assert.equal(headers.has("Content-Type"), init?.body != null, "Public GETs must not trigger a JSON-header CORS preflight");
    await Promise.resolve();
    return Response.json(fail ? { success: false } : { success: true, data: { version: calls } }, { status: fail ? 503 : 200 });
  };
  try {
    const path = "/customer/menu/products?branchId=one";
    const [first, second] = await Promise.all([apiFetch(path), apiFetch(path)]);
    assert.deepEqual(first, second);
    assert.equal(calls, 1, "Concurrent catalog reads share a request");
    await apiFetch(path);
    assert.equal(calls, 1, "Navigation reuses fresh public catalog");
    await apiFetch("/customer/menu/products?branchId=two");
    assert.equal(calls, 2, "Branches have independent cache entries");
    now += 30_001;
    await apiFetch(path);
    assert.equal(calls, 3, "Expired prices are fetched again");
    for (const freshPath of ["/customer/branches", "/customer/me/orders", "/customer/me/dashboard"]) {
      const before: number = calls;
      await apiFetch(freshPath);
      await apiFetch(freshPath);
      assert.equal(calls - before, 2, `${freshPath} is never cached`);
    }
    for (const init of [{ accessToken: "test-only" }, { method: "POST", body: "{}" }]) {
      const before: number = calls;
      await apiFetch(path, init);
      await apiFetch(path, init);
      assert.equal(calls - before, 2, "Authenticated and write requests bypass browsing cache");
    }
    const quoteCalls = calls;
    await apiFetch("/customer/checkout/quote", { method: "POST", body: "{}" });
    await apiFetch("/customer/checkout/quote", { method: "POST", body: "{}" });
    assert.equal(calls - quoteCalls, 2, "Checkout always uses a fresh authoritative quote");
    fail = true;
    await assert.rejects(apiFetch("/customer/menu/products?branchId=retry"));
    fail = false;
    await apiFetch("/customer/menu/products?branchId=retry");
    AbortSignal.timeout = () => originalTimeout(10);
    globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    const keepAlive = setTimeout(() => {}, 1000);
    try {
      await assert.rejects(apiFetch("/customer/menu/products?branchId=timeout"), /Server javobi kechikmoqda/);
      const controller = new AbortController();
      const request = apiFetch("/customer/branches", { signal: controller.signal });
      controller.abort(new Error("cancelled by caller"));
      await assert.rejects(request, /cancelled by caller/);
    } finally {
      clearTimeout(keepAlive);
    }
    console.log("PASS: catalog deduplication, expiry, branch isolation, retries, fresh auth/checkout/order data, request timeout and caller cancellation");
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    AbortSignal.timeout = originalTimeout;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

void main();
