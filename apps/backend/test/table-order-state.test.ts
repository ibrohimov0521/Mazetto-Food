import assert from "node:assert/strict";
import test from "node:test";
import { releaseTableIfNoActiveOrders } from "../src/modules/tables/table-order-state";

function createTransaction(
  activeOrders: number,
  lockRows = [{ id: "table-1" }],
) {
  const calls: string[] = [];
  let locked = false;
  let updates = 0;
  let countCalls = 0;
  let updateArgs: unknown;
  const tx = {
    $queryRawUnsafe: async (query: string, ...values: unknown[]) => {
      assert.match(query, /FOR UPDATE/);
      assert.deepEqual(values, ["table-1"]);
      calls.push("lock");
      locked = true;
      return lockRows;
    },
    order: {
      count: async (args: unknown) => {
        assert.equal(locked, true);
        assert.deepEqual(args, {
          where: {
            tableId: "table-1",
            status: {
              in: ["NEW", "CONFIRMED", "PREPARING", "READY", "SERVED"],
            },
          },
        });
        calls.push("count");
        countCalls += 1;
        return activeOrders;
      },
    },
    restaurantTable: {
      update: async (args: unknown) => {
        assert.equal(locked, true);
        calls.push("update");
        updates += 1;
        updateArgs = args;
      },
    },
  };

  return {
    calls,
    tx,
    get countCalls() {
      return countCalls;
    },
    get updates() {
      return updates;
    },
    get updateArgs() {
      return updateArgs;
    },
  };
}

test("boshqa faol orderi bor stol bo'shatilmaydi", async () => {
  const fixture = createTransaction(1);

  await releaseTableIfNoActiveOrders(fixture.tx as never, "table-1");

  assert.deepEqual(fixture.calls, ["lock", "count"]);
  assert.equal(fixture.updates, 0);
});

test("oxirgi order yopilgach, qulflangan stol bo'shatiladi", async () => {
  const fixture = createTransaction(0);

  await releaseTableIfNoActiveOrders(fixture.tx as never, "table-1");

  assert.deepEqual(fixture.calls, ["lock", "count", "update"]);
  assert.deepEqual(fixture.updateArgs, {
    where: { id: "table-1" },
    data: { status: "AVAILABLE" },
  });
});

test("stol topilmasa faol buyurtma tekshirilmaydi yoki yangilanmaydi", async () => {
  const fixture = createTransaction(0, []);

  await releaseTableIfNoActiveOrders(fixture.tx as never, "table-1");

  assert.deepEqual(fixture.calls, ["lock"]);
  assert.equal(fixture.countCalls, 0);
  assert.equal(fixture.updates, 0);
});
