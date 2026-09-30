import assert from "node:assert/strict";
import test from "node:test";
import {
  clearApiFreshness,
  getApiFreshnessSnapshot,
  recordApiResponseFreshness,
  subscribeApiFreshness,
} from "../lib/offline-freshness.mjs";

test("cached responses retain server cache time until the resource is live again", () => {
  clearApiFreshness();
  recordApiResponseFreshness(
    "/pos/catalog",
    "offline-cache",
    "2026-09-30T06:10:00.000Z",
  );
  recordApiResponseFreshness(
    "/cash-register/shift",
    "offline-cache",
    "2026-09-30T06:20:00.000Z",
  );
  assert.deepEqual(getApiFreshnessSnapshot(), {
    cachedResponses: 2,
    oldestCachedAt: "2026-09-30T06:10:00.000Z",
  });

  recordApiResponseFreshness("/pos/catalog", "online", null);
  assert.deepEqual(getApiFreshnessSnapshot(), {
    cachedResponses: 1,
    oldestCachedAt: "2026-09-30T06:20:00.000Z",
  });
  clearApiFreshness();
});

test("realtime catch-up and queued writes do not mark cached reads current", () => {
  clearApiFreshness();
  recordApiResponseFreshness(
    "/pos/catalog",
    "offline-cache",
    "2026-09-30T06:10:00.000Z",
  );
  recordApiResponseFreshness("/realtime/events?cursor=1", "online", null);
  recordApiResponseFreshness("/pos/orders", "offline-queued", null);
  assert.equal(getApiFreshnessSnapshot().cachedResponses, 1);
  clearApiFreshness();
});

test("subscribers receive snapshots and can unsubscribe", () => {
  clearApiFreshness();
  const snapshots = [];
  const unsubscribe = subscribeApiFreshness((snapshot) =>
    snapshots.push(snapshot),
  );
  recordApiResponseFreshness(
    "/pos/catalog",
    "offline-cache",
    "2026-09-30T06:10:00.000Z",
  );
  unsubscribe();
  recordApiResponseFreshness("/pos/catalog", "online", null);
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[1].cachedResponses, 1);
  clearApiFreshness();
});
