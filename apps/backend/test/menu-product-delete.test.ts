import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { MenuService } from "../src/modules/menu/menu.service";

test("permanent deletion removes cart rows and keeps order snapshots", async () => {
  const calls: string[] = [];
  const tx = {
    product: {
      findMany: async () => [{ id: "p1" }, { id: "p2" }],
      deleteMany: async () => {
        calls.push("products");
        return { count: 2 };
      },
    },
    cartItem: {
      deleteMany: async () => {
        calls.push("cart-items");
      },
    },
  };
  const prisma = { $transaction: (callback: (tx: typeof tx) => unknown) => callback(tx) };
  const service = new MenuService(prisma as never);

  const result = await service.deleteProductsPermanently(["p1", "p2", "p1"]);

  assert.deepEqual(result, { deletedCount: 2 });
  assert.deepEqual(calls, ["cart-items", "products"]);
});

test("missing product aborts deletion before carts or products change", async () => {
  let deleteAttempted = false;
  const tx = {
    product: {
      findMany: async () => [{ id: "p1" }],
      deleteMany: async () => {
        deleteAttempted = true;
      },
    },
    cartItem: {
      deleteMany: async () => {
        deleteAttempted = true;
      },
    },
  };
  const prisma = { $transaction: (callback: (tx: typeof tx) => unknown) => callback(tx) };
  const service = new MenuService(prisma as never);

  await assert.rejects(
    service.deleteProductsPermanently(["p1", "missing"]),
    (error: unknown) => error instanceof NotFoundException,
  );
  assert.equal(deleteAttempted, false);
});
