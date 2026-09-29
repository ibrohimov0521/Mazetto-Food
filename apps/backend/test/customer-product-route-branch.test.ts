import assert from "node:assert/strict";
import test from "node:test";
import { CustomerPublicController } from "../src/modules/customers/customers.controller";

test("customer product route forwards branch and trusted tenant to the service", async () => {
  let received: { id: string; branchId?: string; tenantId: string } | undefined;
  const controller = Object.create(
    CustomerPublicController.prototype,
  ) as CustomerPublicController;
  Object.assign(controller, {
    customersService: {
      getProduct: async (
        id: string,
        branchId: string | undefined,
        tenantId: string,
      ) => {
        received =
          branchId === undefined
            ? { id, tenantId }
            : { id, branchId, tenantId };
        return { id };
      },
    },
  });

  await controller.getProduct("product-1", "branch-2", {
    tenantContext: {
      kind: "TRUSTED",
      hostname: "restaurant.test",
      tenantId: "tenant-a",
    },
  } as never);

  assert.deepEqual(received, {
    id: "product-1",
    branchId: "branch-2",
    tenantId: "tenant-a",
  });
});
