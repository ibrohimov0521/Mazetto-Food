import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { recordOrderEvent } from "../src/modules/orders/order-events";

test("published order events atomically receive their branch revision", async () => {
  const calls: string[] = [];
  let outboxData: Record<string, unknown> | undefined;
  const tx = {
    orderEvent: {
      create: async () => {
        calls.push("order-event");
        return {
          id: "order-event-1",
          createdAt: new Date("2026-09-30T00:00:00Z"),
        };
      },
    },
    $queryRaw: async (strings: TemplateStringsArray) => {
      calls.push("branch-revision");
      assert.match(strings.join("?"), /realtime_revision/);
      return [{ branchRevision: 42n }];
    },
    outboxEvent: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.push("outbox-event");
        outboxData = args.data;
      },
    },
  } as never;

  await recordOrderEvent(tx, {
    orderId: "order-1",
    branchId: "branch-1",
    aggregateVersion: 1,
    eventType: "OrderPlaced",
    actorType: "STAFF",
    source: "POS",
  });

  assert.deepEqual(calls, ["order-event", "branch-revision", "outbox-event"]);
  assert.equal(outboxData?.branchRevision, 42n);
});

test("unpublished order events do not advance the realtime stream", async () => {
  let revisionReads = 0;
  const tx = {
    orderEvent: {
      create: async () => ({ id: "order-event-1", createdAt: new Date() }),
    },
    $queryRaw: async () => {
      revisionReads += 1;
      return [{ branchRevision: 1n }];
    },
    outboxEvent: { create: async () => assert.fail("must not publish") },
  } as never;

  await recordOrderEvent(tx, {
    orderId: "order-1",
    branchId: "branch-1",
    aggregateVersion: 1,
    eventType: "OrderPlaced",
    actorType: "SYSTEM",
    source: "SYSTEM",
    publish: false,
  });

  assert.equal(revisionReads, 0);
});
test("branch revision migration backfills old events and covers legacy inserts", () => {
  const migration = readFileSync(
    new URL(
      "../prisma/migrations/20260930130000_branch_realtime_revision/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /ROW_NUMBER\(\) OVER/);
  assert.match(migration, /PARTITION BY "branchId"/);
  assert.match(
    migration,
    /CREATE TRIGGER "outbox_events_assign_branch_revision"/,
  );
  assert.match(
    migration,
    /RETURNING "realtime_revision" INTO NEW\."branch_revision"/,
  );
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM/);
});
