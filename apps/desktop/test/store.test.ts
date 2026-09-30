import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
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
      cacheKey: DesktopStore.cacheKey(
        "https://api.example.test/current",
        currentScope,
      ),
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

test("desktop store migrates existing databases for local printer retry timing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-desktop-"));
  const path = join(directory, "test.sqlite");
  const initial = new DesktopStore(path);
  initial.close();

  const legacy = new DatabaseSync(path);
  legacy.exec(
    "DROP INDEX local_print_jobs_due_idx; " +
      "ALTER TABLE print_jobs DROP COLUMN next_attempt_at",
  );
  legacy.close();

  const migrated = new DesktopStore(path);
  try {
    migrated.enqueueLocalPrintJob({
      logicalKey: "legacy-order:RECEIPT",
      branchId: "branch-1",
      documentType: "RECEIPT",
      payload: { orderId: "legacy-order" },
    });
    assert.ok(migrated.claimLocalPrintJob(["RECEIPT"]));
  } finally {
    migrated.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("local print retries back off and stop at the dead-letter limit", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-desktop-"));
  const store = new DesktopStore(join(directory, "test.sqlite"));
  let now = new Date("2026-09-30T10:00:00.000Z");

  try {
    store.enqueueLocalPrintJob({
      logicalKey: "offline-order:RECEIPT",
      branchId: "branch-1",
      documentType: "RECEIPT",
      payload: { orderId: "offline-order" },
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const job = store.claimLocalPrintJob(["RECEIPT"], now);
      assert.ok(job);
      assert.equal(job.attempts, attempt);
      store.failLocalPrintJob(job.id, "Printer is offline", now);
      assert.equal(store.claimLocalPrintJob(["RECEIPT"], now), null);

      if (attempt < 5) {
        now = new Date(now.getTime() + 5_000 * 2 ** (attempt - 1));
      }
    }

    assert.equal(store.listLocalPrintJobs()[0]?.state, "dead_letter");
    assert.equal(store.listLocalPrintJobs()[0]?.attempts, 5);
  } finally {
    store.close();
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

test("desktop store enforces cache retention on startup without crossing scopes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-desktop-"));
  const path = join(directory, "test.sqlite");
  const expiredScope = DesktopStore.authScope("Bearer expired-scope");
  const activeScope = DesktopStore.authScope("Bearer active-scope");
  const expiredUrl = "https://api.example.test/expired";
  const activeUrl = "https://api.example.test/active";
  const expiredKey = DesktopStore.cacheKey(expiredUrl, expiredScope);
  const activeKey = DesktopStore.cacheKey(activeUrl, activeScope);

  const initialStore = new DesktopStore(path);
  initialStore.close();

  const database = new DatabaseSync(path);
  try {
    const insert = database.prepare(
      `INSERT INTO api_cache (
        cache_key, request_url, auth_scope, status, content_type, body, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    insert.run(
      expiredKey,
      expiredUrl,
      expiredScope,
      200,
      "application/json",
      "{}",
      "2020-01-01T00:00:00.000Z",
    );
    insert.run(
      activeKey,
      activeUrl,
      activeScope,
      200,
      "application/json",
      "{}",
      new Date().toISOString(),
    );
  } finally {
    database.close();
  }

  const reopenedStore = new DesktopStore(path);
  try {
    assert.equal(reopenedStore.getCachedResponse(expiredKey), null);
    assert.ok(reopenedStore.getCachedResponse(activeKey));
    assert.equal(reopenedStore.summary().cachedResponses, 1);
  } finally {
    reopenedStore.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("desktop store persists realtime cursors per stream across restarts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-desktop-"));
  const path = join(directory, "test.sqlite");
  const posStream = "mazetto.staff.realtime.cursor.user-1%3Apos:branch-1";
  const kitchenStream =
    "mazetto.staff.realtime.cursor.user-1%3Akitchen:branch-1";

  try {
    const firstStore = new DesktopStore(path);
    try {
      firstStore.setSyncCursor(posStream, "pos-cursor-1");
      firstStore.setSyncCursor(kitchenStream, "kitchen-cursor-1");
      firstStore.setSyncCursor(posStream, "pos-cursor-2");
      assert.equal(firstStore.getSyncCursor(posStream), "pos-cursor-2");
      assert.equal(firstStore.getSyncCursor(kitchenStream), "kitchen-cursor-1");
    } finally {
      firstStore.close();
    }

    const reopenedStore = new DesktopStore(path);
    try {
      assert.equal(reopenedStore.getSyncCursor(posStream), "pos-cursor-2");
      assert.equal(
        reopenedStore.getSyncCursor(kitchenStream),
        "kitchen-cursor-1",
      );
      assert.equal(reopenedStore.getSyncCursor("unknown-stream"), null);
    } finally {
      reopenedStore.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("printer target receipts persist and ambiguous jobs stop automatic retries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-desktop-"));
  const path = join(directory, "test.sqlite");
  let jobId = "";

  try {
    const store = new DesktopStore(path);
    try {
      store.enqueueLocalPrintJob({
        logicalKey: "timeout-order:RECEIPT",
        branchId: "branch-1",
        documentType: "RECEIPT",
        payload: { orderId: "timeout-order" },
      });
      const job = store.claimLocalPrintJob(["RECEIPT"]);
      assert.ok(job);
      jobId = job.id;

      store.recordPrintTarget("local", job.id, "Till A", "printed");
      store.recordPrintTarget("local", job.id, "till a", "ambiguous");
      store.recordPrintTarget("local", job.id, "Kitchen 1", "ambiguous");

      assert.equal(store.wasPrintTargetPrinted("local", job.id, "TILL A"), true);
      assert.equal(
        store.wasPrintTargetPrinted("local", job.id, "Kitchen 1"),
        false,
      );
      store.failLocalPrintJob(
        job.id,
        "Printer natijasi noma'lum; qog'ozni tekshiring.",
        new Date(),
        true,
      );

      assert.equal(store.listLocalPrintJobs()[0]?.state, "dead_letter");
      assert.equal(store.listLocalPrintJobs()[0]?.attempts, 1);
      assert.equal(store.claimLocalPrintJob(["RECEIPT"]), null);
    } finally {
      store.close();
    }

    const reopened = new DesktopStore(path);
    try {
      assert.equal(
        reopened.wasPrintTargetPrinted("local", jobId, "Till A"),
        true,
      );
      assert.equal(
        reopened.wasPrintTargetPrinted("local", jobId, "Kitchen 1"),
        false,
      );
    } finally {
      reopened.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
