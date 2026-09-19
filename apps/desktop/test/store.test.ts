import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DesktopStore } from "../src/store.js";

test("desktop store persists scoped API snapshots without storing bearer tokens", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-desktop-"));
  const path = join(directory, "test.sqlite");
  const authorization = "Bearer secret-value";
  const authScope = DesktopStore.authScope(authorization);
  const requestUrl = "https://api.example.test/api/v1/branches";
  const cacheKey = DesktopStore.cacheKey(requestUrl, authScope);
  const store = new DesktopStore(path);

  try {
    store.putCachedResponse({
      cacheKey,
      requestUrl,
      authScope,
      status: 200,
      contentType: "application/json",
      body: '{"success":true,"data":[]}',
      cachedAt: "2026-09-15T00:00:00.000Z",
    });

    assert.deepEqual(store.getCachedResponse(cacheKey), {
      cacheKey,
      requestUrl,
      authScope,
      status: 200,
      contentType: "application/json",
      body: '{"success":true,"data":[]}',
      cachedAt: "2026-09-15T00:00:00.000Z",
    });
    assert.equal(store.summary().cachedResponses, 1);
    assert.notEqual(authScope, authorization);
    assert.equal(authScope.includes("secret-value"), false);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("desktop store removes expired cache entries without touching another scope", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-desktop-"));
  const path = join(directory, "test.sqlite");
  const store = new DesktopStore(path);
  const oldScope = DesktopStore.authScope("Bearer old-scope");
  const currentScope = DesktopStore.authScope("Bearer current-scope");

  try {
    store.putCachedResponse({
      cacheKey: DesktopStore.cacheKey("https://api.example.test/old", oldScope),
      requestUrl: "https://api.example.test/old",
      authScope: oldScope,
      status: 200,
      contentType: "application/json",
      body: "{}",
      cachedAt: "2020-01-01T00:00:00.000Z",
    });
    store.putCachedResponse({
      cacheKey: DesktopStore.cacheKey("https://api.example.test/current", currentScope),
      requestUrl: "https://api.example.test/current",
      authScope: currentScope,
      status: 200,
      contentType: "application/json",
      body: "{}",
      cachedAt: new Date().toISOString(),
    });

    assert.equal(
      store.getCachedResponse(
        DesktopStore.cacheKey("https://api.example.test/old", oldScope),
      ),
      null,
    );
    assert.ok(
      store.getCachedResponse(
        DesktopStore.cacheKey("https://api.example.test/current", currentScope),
      ),
    );
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("rotated JWTs for the same user and branch share one cache scope", () => {
  const payload = Buffer.from(
    JSON.stringify({
      id: "user-1",
      branchId: "branch-1",
      isGlobalScope: false,
    }),
  ).toString("base64url");
  const first = DesktopStore.authScope(
    `Bearer header.${payload}.signature-one`,
  );
  const rotated = DesktopStore.authScope(
    `Bearer header.${payload}.signature-two`,
  );

  assert.equal(first, rotated);
});

test("desktop store creates one stable device identity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-desktop-"));
  const path = join(directory, "test.sqlite");
  const first = new DesktopStore(path);

  try {
    const deviceId = first.deviceId();
    assert.match(deviceId, /^[0-9a-f-]{36}$/i);
    assert.equal(first.deviceId(), deviceId);
    first.close();

    const reopened = new DesktopStore(path);
    assert.equal(reopened.deviceId(), deviceId);
    reopened.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("desktop store recovers interrupted sending mutations on reopen", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-desktop-"));
  const path = join(directory, "test.sqlite");
  const first = new DesktopStore(path);

  try {
    const command = first.enqueueMutation({
      idempotencyKey: "recover-key",
      commandType: "POST /api/v1/pos/orders",
      aggregateType: "pos",
      actorId: "cashier-1",
      branchId: "branch-1",
      authScope: "scope-1",
      payload: { method: "POST", targetUrl: "https://api.test/pos/orders" },
    });
    first.markMutationSending(command.id);
    assert.equal(first.summary().sendingCommands, 1);
    first.close();

    const reopened = new DesktopStore(path);
    assert.equal(reopened.summary().sendingCommands, 0);
    assert.equal(reopened.summary().pendingCommands, 1);
    assert.equal(reopened.dueMutations("scope-1").length, 1);
    reopened.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("desktop store lists, retries and cancels queued mutations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-desktop-"));
  const path = join(directory, "test.sqlite");
  const store = new DesktopStore(path);

  try {
    const command = store.enqueueMutation({
      idempotencyKey: "manual-key",
      commandType: "POST /api/v1/pos/orders",
      aggregateType: "pos",
      aggregateId: "order-1",
      actorId: "cashier-1",
      branchId: "branch-1",
      authScope: "scope-1",
      payload: {
        method: "POST",
        pathname: "/api/v1/pos/orders",
        targetUrl: "https://api.test/api/v1/pos/orders",
        queuedAt: "2026-09-15T00:00:00.000Z",
      },
    });

    assert.equal(store.listOutbox().length, 1);
    assert.equal(store.listOutbox()[0]?.payload.pathname, "/api/v1/pos/orders");

    store.markMutationConflict(command.id, "stale version");
    assert.equal(store.summary().conflictCommands, 1);
    assert.equal(store.retryMutation(command.id), true);
    assert.equal(store.summary().pendingCommands, 1);

    assert.equal(store.cancelMutation(command.id), true);
    assert.equal(store.listOutbox().length, 0);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
