import assert from "node:assert/strict";
import test from "node:test";
import {
  clearApiFreshness,
  formatApiFreshnessAge,
  getApiSyncStatusLabel,
  getApiFreshnessScope,
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
  assert.deepEqual(
    getApiFreshnessSnapshot(Date.parse("2026-09-30T06:24:59.000Z")),
    {
      cachedResponses: 2,
      oldestCachedAt: "2026-09-30T06:10:00.000Z",
      freshnessState: "cached",
    },
  );

  recordApiResponseFreshness("/pos/catalog", "online", null);
  assert.deepEqual(
    getApiFreshnessSnapshot(Date.parse("2026-09-30T06:24:59.000Z")),
    {
      cachedResponses: 1,
      oldestCachedAt: "2026-09-30T06:20:00.000Z",
      freshnessState: "cached",
    },
  );
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

test("cache becomes stale after 15 minutes and unknown timestamps fail closed", () => {
  clearApiFreshness();
  recordApiResponseFreshness(
    "/pos/catalog",
    "offline-cache",
    "2026-09-30T06:10:00.000Z",
  );

  assert.equal(
    getApiFreshnessSnapshot(Date.parse("2026-09-30T06:24:59.000Z"))
      .freshnessState,
    "cached",
  );
  assert.equal(
    getApiFreshnessSnapshot(Date.parse("2026-09-30T06:25:00.000Z"))
      .freshnessState,
    "stale",
  );

  recordApiResponseFreshness("/orders", "offline-cache", null);
  const snapshot = getApiFreshnessSnapshot(
    Date.parse("2026-09-30T06:11:00.000Z"),
  );
  assert.equal(snapshot.freshnessState, "stale");
  assert.equal(snapshot.oldestCachedAt, "2026-09-30T06:10:00.000Z");
  clearApiFreshness();
});

test("cache age is readable and invalid timestamps are explicit", () => {
  const now = Date.parse("2026-09-30T06:30:00.000Z");

  assert.equal(
    formatApiFreshnessAge("2026-09-30T06:25:00.000Z", now),
    "5 daq avval",
  );
  assert.equal(formatApiFreshnessAge(null, now), "yoshi noma'lum");
});

test("freshness is isolated by the panel that consumed the cached response", () => {
  clearApiFreshness();
  const now = Date.parse("2026-09-30T06:12:00.000Z");
  recordApiResponseFreshness(
    "/orders",
    "offline-cache",
    "2026-09-30T06:10:00.000Z",
    "/pos",
  );

  assert.equal(getApiFreshnessSnapshot(now, "/pos").cachedResponses, 1);
  assert.equal(getApiFreshnessSnapshot(now, "/kitchen").cachedResponses, 0);
  assert.equal(getApiFreshnessSnapshot(now, "/kitchen").freshnessState, "live");

  recordApiResponseFreshness(
    "/orders",
    "offline-cache",
    "2026-09-30T06:10:00.000Z",
    "/kitchen",
  );
  assert.equal(getApiFreshnessSnapshot(now, "/kitchen").cachedResponses, 1);

  recordApiResponseFreshness("/orders", "online", null, "/pos");
  assert.equal(getApiFreshnessSnapshot(now, "/pos").cachedResponses, 0);
  assert.equal(getApiFreshnessSnapshot(now, "/kitchen").cachedResponses, 0);
  clearApiFreshness();
});

test("freshness cache scope separates users and their effective permissions", () => {
  clearApiFreshness();
  const userA = getApiFreshnessScope({
    id: "user-a",
    employeeId: "employee-1",
    tenantId: "tenant-a",
    membershipId: "membership-1",
    credentialVersion: 3,
    branchId: "branch-1",
    roles: ["CASHIER", "POS"],
    permissions: ["orders.read", "orders.create"],
  });
  const userAReordered = getApiFreshnessScope({
    id: "user-a",
    employeeId: "employee-1",
    tenantId: "tenant-a",
    membershipId: "membership-1",
    credentialVersion: 3,
    branchId: "branch-1",
    roles: ["POS", "CASHIER", "POS"],
    permissions: ["orders.create", "orders.read", "orders.read"],
  });
  const userB = getApiFreshnessScope({
    id: "user-b",
    branchId: "branch-1",
    roles: ["CASHIER", "POS"],
    permissions: ["orders.read", "orders.create"],
  });

  assert.equal(userA, userAReordered);
  assert.notEqual(userA, userB);
  recordApiResponseFreshness(
    "/orders",
    "offline-cache",
    "2026-09-30T06:10:00.000Z",
    "/pos",
    userA,
  );
  recordApiResponseFreshness(
    "/orders",
    "offline-cache",
    "2026-09-30T06:10:00.000Z",
    "/pos",
    userB,
  );

  const now = Date.parse("2026-09-30T06:12:00.000Z");
  assert.equal(getApiFreshnessSnapshot(now, "/pos", userA).cachedResponses, 1);
  assert.equal(getApiFreshnessSnapshot(now, "/pos", userB).cachedResponses, 1);

  recordApiResponseFreshness("/orders", "online", null, "/pos", userA);
  assert.equal(getApiFreshnessSnapshot(now, "/pos", userA).cachedResponses, 0);
  assert.equal(getApiFreshnessSnapshot(now, "/pos", userB).cachedResponses, 1);
  clearApiFreshness();
});

test("freshness scope isolates tenant, membership, employee and credential changes", () => {
  clearApiFreshness();
  const base = {
    id: "same-user",
    employeeId: "employee-1",
    tenantId: "tenant-a",
    membershipId: "membership-1",
    credentialVersion: 3,
    branchId: "branch-1",
    roles: ["CASHIER"],
    permissions: ["orders.read"],
  };
  const baseScope = getApiFreshnessScope(base);

  for (const changes of [
    { tenantId: "tenant-b" },
    { membershipId: "membership-2" },
    { employeeId: "employee-2" },
    { credentialVersion: 4 },
  ]) {
    assert.notEqual(getApiFreshnessScope({ ...base, ...changes }), baseScope);
  }

  recordApiResponseFreshness(
    "/orders",
    "offline-cache",
    "2026-09-30T06:10:00.000Z",
    "/pos",
    baseScope,
  );
  const now = Date.parse("2026-09-30T06:12:00.000Z");
  assert.equal(
    getApiFreshnessSnapshot(now, "/pos", baseScope).cachedResponses,
    1,
  );
  assert.equal(
    getApiFreshnessSnapshot(
      now,
      "/pos",
      getApiFreshnessScope({ ...base, membershipId: "membership-2" }),
    ).cachedResponses,
    0,
  );
  clearApiFreshness();
});

test("sync status distinguishes refreshes from live, cached, stale and offline data", () => {
  const status = (overrides) =>
    getApiSyncStatusLabel({
      cachedResponses: 0,
      freshnessState: "live",
      isOffline: false,
      isConnecting: false,
      refreshing: false,
      ...overrides,
    });

  assert.equal(status({ refreshing: true }), "Yangilanmoqda");
  assert.equal(
    status({ cachedResponses: 2, refreshing: true }),
    "Kesh yangilanmoqda",
  );
  assert.equal(
    status({
      cachedResponses: 2,
      freshnessState: "stale",
      refreshing: true,
    }),
    "Eski kesh yangilanmoqda",
  );
  assert.equal(status({ isConnecting: true }), "Ulanmoqda");
  assert.equal(status({}), "Ulangan");
  assert.equal(status({ isOffline: true }), "Aloqa uzildi");
  assert.equal(
    status({ cachedResponses: 2, isOffline: true }),
    "Oflayn · kesh",
  );
  assert.equal(
    status({
      cachedResponses: 2,
      freshnessState: "stale",
      isOffline: true,
    }),
    "Oflayn · kesh eski",
  );
});
