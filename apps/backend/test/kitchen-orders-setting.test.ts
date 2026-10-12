import assert from "node:assert/strict";
import { OrderSource } from "@prisma/client";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { KitchenService } from "../src/modules/kitchen/kitchen.service";

const user: AuthenticatedUser = {
  id: "user-a",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  employeeId: "employee-a",
  branchId: "branch-a",
  roles: ["KITCHEN"],
  permissions: ["KITCHEN_VIEW"],
};

async function readKitchenQueries(showPosOrders: boolean | undefined) {
  const queries: { order?: Record<string, unknown> }[] = [];
  const prisma = {
    restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    kitchenTicket: {
      findMany: async ({ where }: { where: { order?: Record<string, unknown> } }) => {
        queries.push(where);
        return [];
      },
    },
  };
  const settings =
    showPosOrders === undefined
      ? undefined
      : { getBool: async () => showPosOrders };
  const service = new KitchenService(
    prisma as never,
    {} as never,
    settings as never,
  );

  const queue = await service.listOrdersWithOverflow(user);
  await service.listHistory({}, user);
  return { queries, queue };
}

test("POS kitchen orders are hidden from queue and history by default", async () => {
  const { queries, queue } = await readKitchenQueries(undefined);

  assert.equal(queries.length, 2);
  assert.equal(queue.kitchenPosOrdersEnabled, false);
  for (const query of queries) {
    assert.deepEqual(query.order?.source, { not: OrderSource.POS });
  }
});

test("enabling POS kitchen orders includes them in queue and history", async () => {
  const { queries, queue } = await readKitchenQueries(true);

  assert.equal(queries.length, 2);
  assert.equal(queue.kitchenPosOrdersEnabled, true);
  for (const query of queries) {
    assert.equal("source" in (query.order ?? {}), false);
  }
});
