import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { RealtimeService } from "../src/modules/realtime/realtime.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

test("realtime catch-up only reads events for branches in the active tenant", async () => {
  let eventWhere: Record<string, unknown> | undefined;
  const service = new RealtimeService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    branch: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        assert.deepEqual(args.where, { tenantId: "tenant-a" });
        return [{ id: "branch-a1" }, { id: "branch-a2" }];
      },
    },
    outboxEvent: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        eventWhere = args.where;
        return [];
      },
    },
  } as never);

  await service.catchUp(undefined, undefined, undefined, owner);
  assert.deepEqual(eventWhere?.branchId, { in: ["branch-a1", "branch-a2"] });
});

test("realtime catch-up fails closed when the active tenant is ambiguous", async () => {
  let eventReads = 0;
  const service = new RealtimeService({
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
    },
    outboxEvent: {
      findMany: async () => {
        eventReads += 1;
        return [];
      },
    },
  } as never);

  await assert.rejects(service.catchUp(undefined, undefined, undefined, owner));
  assert.equal(eventReads, 0);
});
