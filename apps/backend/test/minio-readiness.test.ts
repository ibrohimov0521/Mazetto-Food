import assert from "node:assert/strict";
import test from "node:test";
import { MinioService } from "../src/modules/uploads/minio.service";

function serviceWithFallback(urls: string[]) {
  const service = Object.create(MinioService.prototype) as MinioService;
  Object.assign(service, { client: null, mediaUploadUrls: urls });
  return service;
}

test("media fallback readiness checks healthz, not the upload route", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    requests.push(String(input));
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  try {
    const service = serviceWithFallback([
      "http://mazetto-food-media:80/__upload?token=ignored",
    ]);

    assert.equal(await service.readiness(), "ready");
    assert.deepEqual(requests, ["http://mazetto-food-media/healthz"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("media fallback readiness rejects non-health responses such as 404", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    requests.push(String(input));
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  try {
    const service = serviceWithFallback([
      "http://mazetto-food-media:80/__upload",
      "http://mazetto-food-media-btinws:80/__upload",
    ]);

    assert.equal(await service.readiness(), "degraded");
    assert.deepEqual(requests, [
      "http://mazetto-food-media/healthz",
      "http://mazetto-food-media-btinws/healthz",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
