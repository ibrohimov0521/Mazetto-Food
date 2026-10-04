import assert from "node:assert/strict";
import test from "node:test";
import { NotificationOutboxWorker } from "../src/modules/notifications/notification-outbox.worker";

function createHarness(
  delivery: "sent" | "failed" | "skipped" | { kind: "retryable"; retryAfterSeconds: number | null },
  expired: boolean = false,
) {
  const job = {
    id: 7,
    tenantId: "tenant-a",
    orderId: "order-a",
    attempts: 1,
    leaseToken: "lease-token",
  };
  const updates: Array<Record<string, unknown>> = [];
  const deadLetters: Array<Record<string, unknown>> = [];
  let telegramCalls = 0;
  const tx = {
    notificationOutbox: {
      updateMany: async (args: Record<string, unknown>) => {
        updates.push(args);
        return { count: 1 };
      },
    },
    notificationDeadLetter: {
      upsert: async (args: Record<string, unknown>) => {
        deadLetters.push(args);
        return {};
      },
    },
  };
  const prisma = {
    notificationOutbox: {
      findMany: async () =>
        expired
          ? [{
              ...job,
              leaseExpiresAt: new Date(Date.now() - 60_000),
            }]
          : [],
      updateMany: async (args: Record<string, unknown>) => {
        updates.push(args);
        return { count: 1 };
      },
    },
    order: {
      findFirst: async () => ({ id: "order-a" }),
    },
    $queryRaw: async () => (expired ? [] : [job]),
    $transaction: async (work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
  };
  const telegram = {
    deliverOutboxNewOrder: async () => {
      telegramCalls += 1;
      return delivery;
    },
  };
  const worker = new NotificationOutboxWorker(
    prisma as never,
    telegram as never,
  );
  return { worker, updates, deadLetters, getTelegramCalls: () => telegramCalls };
}

test("outbox worker marks only confirmed Telegram delivery as delivered", async () => {
  const harness = createHarness("sent");
  await harness.worker.dispatchPending();

  assert.equal(harness.getTelegramCalls(), 1);
  assert.equal(harness.updates.length, 1);
  const update = harness.updates[0]!.data as {
    status: string;
    deliveredAt: Date;
    leaseToken: null;
    leaseExpiresAt: null;
    lastError: null;
  };
  assert.equal(update.status, "DELIVERED");
  assert.ok(update.deliveredAt instanceof Date);
  assert.equal(update.leaseToken, null);
  assert.equal(update.leaseExpiresAt, null);
  assert.equal(update.lastError, null);
  assert.equal(harness.deadLetters.length, 0);
});

test("outbox worker backs off only for an explicit safe Telegram rate limit", async () => {
  const harness = createHarness({
    kind: "retryable",
    retryAfterSeconds: 30,
  });
  const before = Date.now();
  await harness.worker.dispatchPending();

  assert.equal(harness.getTelegramCalls(), 1);
  assert.equal(harness.updates.length, 1);
  const update = harness.updates[0]!.data as {
    status: string;
    scheduledAt: Date;
    leaseToken: null;
    lastError: string;
  };
  assert.equal(update.status, "PENDING");
  assert.ok(update.scheduledAt.getTime() >= before + 30_000);
  assert.equal(update.leaseToken, null);
  assert.match(update.lastError, /retry is safe/);
  assert.equal(harness.deadLetters.length, 0);
});

test("outbox worker moves an unconfirmed send to uncertain and dead-letter atomically", async () => {
  const harness = createHarness("failed");
  await harness.worker.dispatchPending();

  assert.equal(harness.getTelegramCalls(), 1);
  assert.equal(harness.updates.length, 1);
  assert.equal(
    (harness.updates[0]!.data as { status: string }).status,
    "UNCERTAIN",
  );
  assert.equal(harness.deadLetters.length, 1);
  const entry = harness.deadLetters[0]!;
  assert.equal(entry.create && (entry.create as { messageId: string }).messageId, "outbox-7");
  assert.equal(
    (entry.create as { tenantId: string }).tenantId,
    "tenant-a",
  );
  assert.match((entry.create as { error: string }).error, /automatic resend is disabled/);
});

test("expired worker lease is made uncertain without calling Telegram again", async () => {
  const harness = createHarness("sent", true);
  await harness.worker.dispatchPending();

  assert.equal(harness.getTelegramCalls(), 0);
  assert.equal(harness.updates.length, 1);
  assert.equal(
    (harness.updates[0]!.data as { status: string }).status,
    "UNCERTAIN",
  );
  assert.equal(harness.deadLetters.length, 1);
  assert.equal(
    (harness.deadLetters[0]!.create as { messageId: string }).messageId,
    "outbox-7",
  );
});
