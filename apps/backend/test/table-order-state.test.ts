import assert from "node:assert/strict";
import test from "node:test";
import { releaseTableIfNoActiveOrders } from "../src/modules/tables/table-order-state";

test("boshqa faol orderi bor stol bo'shatilmaydi", async () => {
  let updates = 0;
  const tx = {
    order: { count: async () => 1 },
    restaurantTable: { update: async () => updates++ },
  };

  await releaseTableIfNoActiveOrders(tx as never, "table-1");
  assert.equal(updates, 0);
});

test("oxirgi order yopilgach stol bo'shatiladi", async () => {
  let updateArgs: unknown;
  const tx = {
    order: { count: async () => 0 },
    restaurantTable: {
      update: async (args: unknown) => {
        updateArgs = args;
      },
    },
  };

  await releaseTableIfNoActiveOrders(tx as never, "table-1");
  assert.deepEqual(updateArgs, {
    where: { id: "table-1" },
    data: { status: "AVAILABLE" },
  });
});
