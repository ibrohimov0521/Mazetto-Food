import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import type { CreatePosCheckoutDto } from "../src/modules/orders/dto/pos-checkout.dto";
import { OrdersService } from "../src/modules/orders/orders.service";
import {
  createPosCheckoutRequestHash,
  createPosIdempotencyKey,
} from "../src/modules/orders/order-rules";

test("completed POS checkout replay does not republish order side effects", async () => {
  const user: AuthenticatedUser = {
    id: "user-1",
    employeeId: "employee-1",
    branchId: "branch-1",
    roles: ["CASHIER"],
    permissions: ["POS_USE"],
  };
  const dto: CreatePosCheckoutDto = {
    idempotencyKey: "checkout-retry-1",
    cashReceived: 25000,
    items: [{ productId: "product-1", quantity: 1 }],
  };
  const idempotencyKey = createPosIdempotencyKey(dto.idempotencyKey);
  const operation = {
    id: "operation-1",
    orderId: "order-1",
    requestHash: createPosCheckoutRequestHash(dto, "branch-1", "employee-1"),
    status: "COMPLETED",
  };
  const order = { id: "order-1", total: new Prisma.Decimal(25000) };
  let notificationLookups = 0;
  const transaction = {
    branch: {
      findUnique: async () => ({ tenantId: "tenant-a" }),
      findFirst: async () => ({ id: "branch-1" }),
    },
    paymentOperation: { findUnique: async () => operation },
    order: { findUnique: async () => order },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    paymentOperation: { findUnique: async () => operation },
    order: {
      findUnique: async () => {
        notificationLookups += 1;
        return { staffTelegramMessageId: null };
      },
    },
  };
  const emitted: string[] = [];
  const kitchen = {
    emitOrderCreated: () => emitted.push("created"),
    emitOrderConfirmed: () => emitted.push("confirmed"),
    emitOrderSentToKitchen: () => emitted.push("sent-to-kitchen"),
  };
  const telegram = { notifyNewOrder: async () => emitted.push("telegram") };
  const service = new OrdersService(
    prisma as never,
    {} as never,
    kitchen as never,
    telegram as never,
  );

  const result = await service.createPosCheckout(dto, user);

  assert.equal(result.order.id, order.id);
  assert.equal(idempotencyKey, "POS_CHECKOUT:checkout-retry-1");
  assert.deepEqual(emitted, []);
  assert.equal(notificationLookups, 0);
});
