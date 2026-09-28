import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { OnlineOrderTypeDto, OnlinePaymentMethodDto } from "../src/modules/customers/dto/customer.dto";
import { CustomerOrderEngineService } from "../src/modules/customers/customer-order-engine.service";

test("customer checkout validates the branch before reserving or replaying an idempotency key", async () => {
  const touched: string[] = [];
  const service = new CustomerOrderEngineService(
    {
      customer: { findUnique: async () => { touched.push("customer"); return { id: "customer-a" }; } },
      customerOrderAttempt: {
        create: async () => { touched.push("attempt-create"); },
        findUnique: async () => { touched.push("attempt-read"); },
      },
    } as never,
    {
      assertCustomerBranchAcceptsOrder: async (branchId: string) => {
        assert.equal(branchId, "branch-b");
        throw new NotFoundException("Branch not found");
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    service.createOnlineOrder("customer-a", {
      branchId: "branch-b",
      idempotencyKey: "customer-global-key",
      type: OnlineOrderTypeDto.PICKUP,
      paymentMethod: OnlinePaymentMethodDto.CASH,
      items: [],
    } as never),
    NotFoundException,
  );
  assert.deepEqual(touched, ["customer"]);
});
