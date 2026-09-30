import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import {
  encodeBranchRevisionCursor,
  RealtimeService,
} from "../src/modules/realtime/realtime.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

function makeEvent(branchId: string, revision: bigint) {
  return {
    id: `${branchId}-event-${revision}`,
    branchId,
    branchRevision: revision,
    aggregateType: "Order",
    aggregateId: `${branchId}-order-${revision}`,
    eventType: "OrderUpdated",
    payload: {},
    correlationId: null,
    causationId: null,
    createdAt: new Date(Number(revision)),
  };
}

test("branch revision catch-up rotates branches without losing events at small page limits", async () => {
  const byBranch = {
    "branch-a": [1n, 2n, 3n].map((revision) => makeEvent("branch-a", revision)),
    "branch-b": [1n, 2n].map((revision) => makeEvent("branch-b", revision)),
  };
  const service = new RealtimeService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    branch: {
      findMany: async () => [{ id: "branch-a" }, { id: "branch-b" }],
    },
    outboxEvent: {
      findMany: async (args: {
        where: { branchId: string; branchRevision: { gt: bigint } };
        take: number;
      }) =>
        (byBranch[args.where.branchId as keyof typeof byBranch] ?? [])
          .filter(
            (event) => event.branchRevision > args.where.branchRevision.gt,
          )
          .slice(0, args.take),
    },
  } as never);

  let cursor = encodeBranchRevisionCursor({
    "branch-a": "0",
    "branch-b": "0",
  });
  const seen: string[] = [];

  for (let page = 0; page < 6; page += 1) {
    const result = await service.catchUp(cursor, undefined, "1", owner);
    seen.push(...result.events.map((event) => event.aggregateId));
    assert.ok(result.cursor);
    cursor = result.cursor;
    if (!result.hasMore) break;
  }

  assert.deepEqual(seen, [
    "branch-a-order-1",
    "branch-b-order-1",
    "branch-a-order-2",
    "branch-b-order-2",
    "branch-a-order-3",
  ]);
});

test("branch revision catch-up rejects cursors containing an out-of-scope branch", async () => {
  const service = new RealtimeService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    branch: {
      findMany: async () => [{ id: "branch-a" }],
    },
    outboxEvent: { findMany: async () => assert.fail("must not read events") },
  } as never);

  await assert.rejects(
    service.catchUp(
      encodeBranchRevisionCursor({ "branch-other": "4" }, "branch-other"),
      undefined,
      "10",
      owner,
    ),
    /filial doirasiga mos emas/,
  );
});
