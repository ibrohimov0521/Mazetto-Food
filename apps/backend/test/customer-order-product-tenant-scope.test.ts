import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { CustomerOrderEngineService } from "../src/modules/customers/customer-order-engine.service";

test("online checkout scopes shared product lookup to the selected branch category", async () => {
  let where: Record<string, unknown> | undefined;
  const engine = Object.create(
    CustomerOrderEngineService.prototype,
  ) as CustomerOrderEngineService;
  Object.assign(engine, {
    branchesService: {
      getUnavailableProductWhere: () => ({}),
    },
  });
  const internals = engine as unknown as {
    createItemSnapshot(
      tx: unknown,
      branchId: string,
      dto: unknown,
    ): Promise<{ productName: string; totalPrice: Prisma.Decimal }>;
  };

  await internals.createItemSnapshot(
    {
      product: {
        findFirst: async (args: { where: Record<string, unknown> }) => {
          where = args.where;
          return {
            id: "product-shared",
            name: "Shared product",
            sellingPrice: new Prisma.Decimal(12000),
            variants: [],
          };
        },
      },
    },
    "branch-a",
    { productId: "product-shared", quantity: 1, modifiers: [] },
  );

  assert.deepEqual(where?.category, {
    OR: [{ branchId: "branch-a" }, { branchId: null }],
  });
});
