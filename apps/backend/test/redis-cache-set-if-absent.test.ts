import assert from "node:assert/strict";
import test from "node:test";
import { RedisCacheService } from "../src/cache/redis-cache.service";

test("setIfAbsent allows only one concurrent claim for a key", async () => {
  const cache = new RedisCacheService();
  const claims = await Promise.all(
    Array.from({ length: 16 }, () => cache.setIfAbsent("test:claim", 30_000)),
  );

  assert.equal(claims.filter(Boolean).length, 1);
});

test("setIfAbsent keeps independent keys independent", async () => {
  const cache = new RedisCacheService();

  assert.equal(await cache.setIfAbsent("test:first", 30_000), true);
  assert.equal(await cache.setIfAbsent("test:second", 30_000), true);
  assert.equal(await cache.setIfAbsent("test:first", 30_000), false);
});

test("setIfAbsent uses Redis SET PX NX atomically", async () => {
  const cache = new RedisCacheService();
  const calls: unknown[][] = [];
  const replies: Array<"OK" | null> = ["OK", null];
  Object.defineProperty(cache, "redis", {
    value: {
      set: async (...args: unknown[]) => {
        calls.push(args);
        return replies.shift();
      },
    },
  });

  assert.equal(await cache.setIfAbsent("test:claim", 30_000), true);
  assert.equal(await cache.setIfAbsent("test:claim", 30_000), false);
  assert.deepEqual(calls, [
    ["test:claim", "1", "PX", 30_000, "NX"],
    ["test:claim", "1", "PX", 30_000, "NX"],
  ]);
});

test("setIfAbsent fails closed when the Redis command errors", async () => {
  const cache = new RedisCacheService();
  Object.defineProperty(cache, "redis", {
    value: {
      set: async () => {
        throw new Error("redis unavailable");
      },
    },
  });

  assert.equal(await cache.setIfAbsent("test:claim", 30_000), null);
});
