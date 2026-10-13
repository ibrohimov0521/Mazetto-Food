import assert from "node:assert/strict";
import { OrderSource } from "@prisma/client";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { KitchenService } from "../src/modules/kitchen/kitchen.service";
import { isKitchenPosOrder } from "../src/modules/kitchen/kitchen-order-visibility";

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
    assert.deepEqual(query.order?.NOT, {
      source: OrderSource.POS,
    });
  }
});

test("enabling POS kitchen orders includes them in queue and history", async () => {
  const { queries, queue } = await readKitchenQueries(true);

  assert.equal(queries.length, 2);
  assert.equal(queue.kitchenPosOrdersEnabled, true);
  for (const query of queries) {
    assert.equal("NOT" in (query.order ?? {}), false);
  }
});
test("POS ticket detail and actions honor the kitchen visibility setting", async () => {
  for (const enabled of [false, true]) {
    for (const action of ["read", "update"] as const) {
      const queries: { order?: Record<string, unknown> }[] = [];
      const prisma = {
        restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
        branch: { findFirst: async () => ({ id: "branch-a" }) },
        kitchenTicket: {
          findFirst: async ({
            where,
          }: {
            where: { order?: Record<string, unknown> };
          }) => {
            queries.push(where);
            return null;
          },
        },
      };
      const service = new KitchenService(
        prisma as never,
        {} as never,
        { getBool: async () => enabled } as never,
      );

      const request =
        action === "read"
          ? service.getTicket("ticket-pos", user)
          : service.applyTicketAction("ticket-pos", "accept", user);
      await assert.rejects(request, /Oshxona chiptasi topilmadi/);

      if (enabled) {
        assert.equal("NOT" in (queries[0]?.order ?? {}), false);
      } else {
        assert.deepEqual(queries[0]?.order?.NOT, { source: OrderSource.POS });
      }
    }
  }
});

test("kitchen UI action rechecks POS visibility inside its order transaction", async () => {
  const tx = {
    $queryRaw: async () => [],
    order: {
      findFirst: async () => ({
        id: "order-pos",
        branchId: "branch-a",
        source: OrderSource.POS,
        shiftId: null,
      }),
    },
  };
  const prisma = {
    restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
  };
  const settings = {
    getBool: async (
      _key: string,
      _tenantId: string,
      client: typeof tx,
    ) => {
      assert.equal(client, tx);
      return false;
    },
  };
  const service = new KitchenService(
    prisma as never,
    {} as never,
    settings as never,
  );

  await assert.rejects(
    service.applyOrderAction("order-pos", "accept", {
      user,
      reasonPrefix: "Kitchen UI",
      enforceKitchenPosVisibility: true,
    }),
    /Oshxona chiptasi topilmadi/,
  );
});

test("all POS orders are hidden by the kitchen setting, including waiter tables", () => {
  assert.equal(isKitchenPosOrder({ source: OrderSource.POS }), true);
  assert.equal(
    isKitchenPosOrder({ source: OrderSource.WEB }),
    false,
  );
  assert.equal(
    isKitchenPosOrder({ source: OrderSource.TELEGRAM }),
    false,
  );
});
