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

test("paid POS checkout replay restores a missing receipt and print job", async () => {
  const user: AuthenticatedUser = {
    id: "user-1",
    employeeId: "employee-1",
    branchId: "branch-1",
    roles: ["CASHIER"],
    permissions: ["POS_USE"],
  };
  const dto: CreatePosCheckoutDto = {
    idempotencyKey: "checkout-repair-1",
    cashReceived: 25000,
    items: [{ productId: "product-1", quantity: 1 }],
  };
  const operation = {
    id: "operation-1",
    orderId: "order-1",
    requestHash: createPosCheckoutRequestHash(dto, "branch-1", "employee-1"),
    status: "COMPLETED",
  };
  const receiptRows: { id: string; branchId: string; documentType: string }[] = [];
  const order = {
    id: "order-1",
    total: new Prisma.Decimal(25000),
    paymentStatus: "PAID",
    branchId: "branch-1",
    branch: { name: "Sergeli filiali" },
    items: [{
      productName: "Lavash",
      variantName: null,
      quantity: new Prisma.Decimal(1),
      totalPrice: new Prisma.Decimal(25000),
      notes: null,
      modifierSnapshot: null,
    }],
    payments: [{ method: { code: "CASH" }, amount: new Prisma.Decimal(25000) }],
    receipts: receiptRows,
    orderNumber: "POS-1",
    displayOrderNumber: "101",
    type: "TAKEAWAY",
    source: "POS",
    customerName: null,
    customerPhone: null,
    deliveryAddress: null,
    kitchenComment: null,
    notes: null,
  };
  let receiptCreates = 0;
  let printJobCreates = 0;
  const transaction = {
    branch: {
      findUnique: async () => ({ tenantId: "tenant-a" }),
      findFirst: async () => ({ id: "branch-1" }),
    },
    paymentOperation: { findUnique: async () => operation },
    order: { findUnique: async () => order },
    receipt: {
      findUnique: async () => null,
      create: async ({ data }: { data: { branchId: string; documentType: string } }) => {
        receiptCreates += 1;
        const created = { id: "receipt-1", branchId: data.branchId, documentType: data.documentType };
        receiptRows.push(created);
        return { ...created, content: {} };
      },
    },
    printer: { findMany: async () => [] },
    printJob: { create: async () => { printJobCreates += 1; } },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    paymentOperation: { findUnique: async () => operation },
    order: { findUnique: async () => ({ staffTelegramMessageId: null }) },
  };
  const service = new OrdersService(
    prisma as never,
    {} as never,
    {
      emitOrderCreated: () => assert.fail("replay must not republish"),
      emitOrderConfirmed: () => assert.fail("replay must not republish"),
      emitOrderSentToKitchen: () => assert.fail("replay must not republish"),
    } as never,
    { notifyNewOrder: async () => assert.fail("replay must not renotify") } as never,
  );

  const result = await service.createPosCheckout(dto, user);

  assert.equal(receiptCreates, 1);
  assert.equal(printJobCreates, 1);
  assert.deepEqual(result.order.receipts.map((receipt) => receipt.documentType), ["RECEIPT"]);
});

test("POS checkout replays a committed order after an idempotency collision", async () => {
  const user: AuthenticatedUser = {
    id: "user-1",
    employeeId: "employee-1",
    branchId: "branch-1",
    roles: ["CASHIER"],
    permissions: ["POS_USE"],
  };
  const dto: CreatePosCheckoutDto = {
    idempotencyKey: "parallel-terminal-sale",
    cashReceived: 25000,
    items: [{ productId: "product-1", quantity: 1 }],
  };
  const idempotencyKey = createPosIdempotencyKey(dto.idempotencyKey);
  const operation = {
    id: "operation-1",
    orderId: "committed-order",
    requestHash: createPosCheckoutRequestHash(dto, "branch-1", "employee-1"),
    status: "COMPLETED",
  };
  const order = { id: "committed-order", total: new Prisma.Decimal(25000) };
  const uniqueCollision = new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed",
    { code: "P2002", clientVersion: Prisma.prismaVersion.client },
  );
  let transactionAttempts = 0;
  let operationReads = 0;
  let orderReads = 0;
  const prisma = {
    $transaction: async () => {
      transactionAttempts += 1;
      throw uniqueCollision;
    },
    paymentOperation: {
      findUnique: async () => {
        operationReads += 1;
        return operation;
      },
    },
    order: {
      findUnique: async () => {
        orderReads += 1;
        return order;
      },
    },
  };
  const emitted: string[] = [];
  const service = new OrdersService(
    prisma as never,
    {} as never,
    {
      emitOrderCreated: () => emitted.push("created"),
      emitOrderConfirmed: () => emitted.push("confirmed"),
      emitOrderSentToKitchen: () => emitted.push("sent-to-kitchen"),
    } as never,
    { notifyNewOrder: async () => emitted.push("telegram") } as never,
  );

  const result = await service.createPosCheckout(dto, user);

  assert.equal(transactionAttempts, 1);
  assert.equal(operationReads, 2);
  assert.equal(orderReads, 1);
  assert.equal(result.order.id, order.id);
  assert.equal(idempotencyKey, "POS_CHECKOUT:parallel-terminal-sale");
  assert.deepEqual(emitted, []);
});
