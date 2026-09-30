import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { CustomerCourierService } from "../src/modules/customers/customer-courier.service";

const courier: AuthenticatedUser = {
  id: "courier-user-a",
  employeeId: "courier-employee-a",
  branchId: "branch-a",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  isGlobalScope: false,
  roles: ["COURIER"],
  permissions: ["COURIER_DELIVERY_UPDATE"],
};

test("courier status replay returns the tenant-scoped order without repeating effects", async () => {
  const previous = {
    id: "customer-order-a",
    orderId: "order-a",
    type: "DELIVERY",
    branchId: "branch-a",
    order: {
      status: OrderStatus.COMPLETED,
      servedById: courier.employeeId,
      cancelledById: null,
    },
  };
  let transactionCalls = 0;
  let paymentCalls = 0;
  let eventCalls = 0;
  let startInput: Record<string, unknown> | undefined;
  let replayWhere: unknown;
  const prisma = {
    restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    customerOrder: {
      findFirst: async (args: { where: unknown }) => {
        replayWhere = args.where;
        return previous;
      },
    },
    $transaction: async () => {
      transactionCalls += 1;
      throw new Error("replay must not start a write transaction");
    },
  };
  const idempotency = {
    start: async (input: Record<string, unknown>) => {
      startInput = input;
      return {
        kind: "REPLAY" as const,
        record: {
          id: "idem-a",
          resourceId: "customer-order-a",
          resourceType: "CUSTOMER_ORDER",
        },
      };
    },
  };
  const service = new CustomerCourierService(
    prisma as never,
    { emitOrderStatusChanged: () => { eventCalls += 1; } } as never,
    { processOrderPayment: () => { paymentCalls += 1; } } as never,
    idempotency as never,
  );

  const result = await service.updateCourierOrderStatus(
    "customer-order-a",
    { status: "COMPLETED" } as never,
    courier,
    { idempotencyKey: "courier-status-key-a", correlationId: "request-a" },
  );

  assert.equal(result.order.status, OrderStatus.COMPLETED);
  assert.equal(transactionCalls, 0);
  assert.equal(paymentCalls, 0);
  assert.equal(eventCalls, 0);
  assert.deepEqual(replayWhere, {
    id: "customer-order-a",
    type: "DELIVERY",
    branch: { tenantId: "tenant-a", id: "branch-a" },
  });
  assert.equal(
    startInput?.scope,
    "courier-order-status:tenant-a:customer-order-a:courier-employee-a:courier-user-a",
  );
  assert.equal(startInput?.key, "courier-status-key-a");
  assert.equal(startInput?.correlationId, "request-a");
});

test("courier payment, status event, and idempotency completion share one transaction", async () => {
  let transactionActive = false;
  let completedInsideTransaction = false;
  let paymentCalls = 0;
  let paymentInput: Record<string, unknown> | undefined;
  let paymentTransaction: object | undefined;
  let eventInput: Record<string, unknown> | undefined;
  const existing = {
    id: "customer-order-b",
    orderId: "order-b",
    type: "DELIVERY",
    branchId: "branch-a",
    order: {
      status: OrderStatus.READY,
      orderState: "READY",
      servedById: null,
      total: new Prisma.Decimal(42_000),
      payments: [],
    },
  };
  const result = {
    id: "customer-order-b",
    orderId: "order-b",
    type: "DELIVERY",
    order: { status: OrderStatus.COMPLETED },
  };
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) =>
      strings.join("").includes('UPDATE "branches"')
        ? [{ branchRevision: 1n }]
        : [],
    customerOrder: {
      findFirst: async () => existing,
      findUniqueOrThrow: async () => result,
    },
    shift: { findFirst: async () => ({ id: "courier-shift-a" }) },
    order: {
      update: async () => ({ version: 2, orderState: "COMPLETED" }),
    },
    orderEvent: {
      create: async (args: { data: Record<string, unknown> }) => {
        eventInput = args.data;
        return { id: "event-a", createdAt: new Date() };
      },
    },
    outboxEvent: { create: async () => ({ id: "outbox-a" }) },
    kitchenTicket: { updateMany: async () => ({ count: 1 }) },
    orderStatusHistory: { create: async () => ({ id: "history-a" }) },
  };
  const prisma = {
    restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    $transaction: async <T>(callback: (database: typeof tx) => Promise<T>) => {
      transactionActive = true;
      try {
        return await callback(tx);
      } finally {
        transactionActive = false;
      }
    },
  };
  const idempotency = {
    start: async () => ({ kind: "CLAIMED" as const, record: { id: "idem-b" } }),
    complete: async (
      id: string,
      completion: { requestHash: string; resourceId?: string },
      database: object,
    ) => {
      assert.equal(id, "idem-b");
      assert.equal(database, tx);
      assert.equal(transactionActive, true);
      assert.equal(completion.resourceId, "customer-order-b");
      completedInsideTransaction = true;
    },
    fail: async () => {
      throw new Error("successful courier update must not fail its idempotency record");
    },
  };
  const service = new CustomerCourierService(
    prisma as never,
    { emitOrderStatusChanged: () => undefined } as never,
    {
      processOrderPayment: async (
        input: Record<string, unknown>,
        _user: AuthenticatedUser,
        _first: unknown,
        _second: unknown,
        _third: unknown,
        database: object,
      ) => {
        paymentCalls += 1;
        paymentInput = input;
        paymentTransaction = database;
      },
    } as never,
    idempotency as never,
  );

  await service.updateCourierOrderStatus(
    "customer-order-b",
    {
      status: "COMPLETED",
      amount: 42_000,
      shiftId: "courier-shift-a",
      paymentMethodCode: "CASH",
    } as never,
    courier,
    { idempotencyKey: "courier-status-key-b", correlationId: "request-b" },
  );

  assert.equal(paymentCalls, 1);
  assert.equal(paymentInput?.idempotencyKey, "courier-status-key-b");
  assert.equal(paymentTransaction, tx);
  assert.equal(completedInsideTransaction, true);
  assert.equal(eventInput?.idempotencyKey, "courier-status-key-b");
  assert.equal(eventInput?.correlationId, "request-b");
});

test("courier idempotency rejects payload changes before a second mutation", async () => {
  let transactionCalls = 0;
  const prisma = {
    restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    $transaction: async () => {
      transactionCalls += 1;
    },
  };
  const idempotency = {
    start: async () => {
      throw new ConflictException("Idempotency key was already used with a different request");
    },
  };
  const service = new CustomerCourierService(
    prisma as never,
    {} as never,
    {} as never,
    idempotency as never,
  );

  await assert.rejects(
    service.updateCourierOrderStatus(
      "customer-order-c",
      { status: "CANCELLED" } as never,
      courier,
      { idempotencyKey: "courier-status-key-c", correlationId: "request-c" },
    ),
    /different request/,
  );
  assert.equal(transactionCalls, 0);
});
