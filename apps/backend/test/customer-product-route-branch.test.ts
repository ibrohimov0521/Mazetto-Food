import assert from "node:assert/strict";
import test from "node:test";
import { CustomerPublicController } from "../src/modules/customers/customers.controller";

test("customer product route forwards its optional branchId to the service", async () => {
  let received: { id: string; branchId?: string } | undefined;
  const controller = Object.create(
    CustomerPublicController.prototype,
  ) as CustomerPublicController;
  Object.assign(controller, {
    customersService: {
      getProduct: async (id: string, branchId?: string) => {
        received = branchId === undefined ? { id } : { id, branchId };
        return { id };
      },
    },
  });

  await controller.getProduct("product-1", "branch-2");

  assert.deepEqual(received, { id: "product-1", branchId: "branch-2" });
});
