import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { OrdersService } from "../src/modules/orders/orders.service";

const actor: AuthenticatedUser = {
  id: "staff-a",
  employeeId: "employee-a",
  branchId: "branch-a",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  isGlobalScope: false,
  roles: ["WAITER"],
  permissions: ["ORDER_UPDATE"],
};

type MutationRunner<T> = (
  action: string,
  orderId: string,
  payload: unknown,
  user: AuthenticatedUser,
  context: { idempotencyKey?: string; correlationId?: string },
  mutate: (tx: object) => Promise<T>,
  replay: () => Promise<T>,
) => Promise<{ result: T; replayed: boolean }>;

function createHarness(idempotency: object) {
  let inTransaction = false;
  const tx = { idempotencyRequest: {} };
  const prisma = {
    restaurantTenant: {
      findFirst: async () => ({ id: "tenant-a" }),
    },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    $transaction: async (operation: (client: object) => Promise<unknown>) => {
      inTransaction = true;
      try {
        return await operation(tx);
      } finally {
        inTransaction = false;
      }
    },
  };
  const service = new OrdersService(
    prisma as never,
    {} as never,
    {} as never,
    undefined,
    idempotency as never,
  );
  const runMutation = (
    service as unknown as { runOrderMutation: MutationRunner<string> }
  ).runOrderMutation.bind(service);
  return { inTransaction: () => inTransaction, runMutation, tx };
}

test("order mutation and idempotency completion share one transaction", async () => {
  const { inTransaction, runMutation, tx } = createHarness({
    start: async () => ({ kind: "CLAIMED", record: { id: "idem-a" } }),
    complete: async (_id: string, _result: unknown, db: object) => {
      assert.equal(db, tx);
      assert.equal(inTransaction(), true);
    },
    fail: async () =>
      assert.fail("successful mutation must not be marked failed"),
  });
  let mutationCalls = 0;

  const result = await runMutation(
    "item-add",
    "order-a",
    { productId: "product-a", expectedVersion: 4 },
    actor,
    { idempotencyKey: "idempotency-key-a", correlationId: "request-a" },
    async () => {
      mutationCalls += 1;
      assert.equal(inTransaction(), true);
      return "saved";
    },
    async () => "replayed",
  );

  assert.deepEqual(result, { result: "saved", replayed: false });
  assert.equal(mutationCalls, 1);
});

test("completed order mutation replay does not execute the write again", async () => {
  let transactionCalls = 0;
  let mutationCalls = 0;
  let replayCalls = 0;
  const idempotency = {
    start: async () => ({
      kind: "REPLAY" as const,
      record: {
        id: "idem-b",
        resourceType: "ORDER",
        resourceId: "order-b",
      },
    }),
    complete: async () => assert.fail("replay must not complete twice"),
    fail: async () => assert.fail("replay must not fail"),
  };
  const prisma = {
    restaurantTenant: {
      findFirst: async () => ({ id: "tenant-a" }),
    },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    $transaction: async () => {
      transactionCalls += 1;
    },
  };
  const service = new OrdersService(
    prisma as never,
    {} as never,
    {} as never,
    undefined,
    idempotency as never,
  );
  const runMutation = (
    service as unknown as { runOrderMutation: MutationRunner<string> }
  ).runOrderMutation.bind(service);

  const result = await runMutation(
    "status-update",
    "order-b",
    { status: "READY" },
    actor,
    { idempotencyKey: "idempotency-key-b", correlationId: "request-b" },
    async () => {
      mutationCalls += 1;
      return "written";
    },
    async () => {
      replayCalls += 1;
      return "current-order";
    },
  );

  assert.deepEqual(result, { result: "current-order", replayed: true });
  assert.equal(transactionCalls, 0);
  assert.equal(mutationCalls, 0);
  assert.equal(replayCalls, 1);
});

test("order mutation failure marks the claimed key failed for safe retry", async () => {
  let failedWith: unknown[] | undefined;
  let completed = false;
  const { runMutation } = createHarness({
    start: async () => ({ kind: "CLAIMED", record: { id: "idem-c" } }),
    complete: async () => {
      completed = true;
    },
    fail: async (...args: unknown[]) => {
      failedWith = args;
    },
  });

  await assert.rejects(
    runMutation(
      "item-update",
      "order-c",
      { itemId: "item-c", quantity: 2 },
      actor,
      { idempotencyKey: "idempotency-key-c", correlationId: "request-c" },
      async () => {
        throw new Error("write failed");
      },
      async () => "replayed",
    ),
    /write failed/,
  );

  assert.equal(completed, false);
  assert.equal(failedWith?.[0], "idem-c");
  assert.equal(failedWith?.[2], "ORDER_MUTATION_FAILED");
});

test("completed replay is rejected when its resource does not match the order", async () => {
  const { runMutation } = createHarness({
    start: async () => ({
      kind: "REPLAY" as const,
      record: {
        id: "idem-d",
        resourceType: "ORDER",
        resourceId: "order-other",
      },
    }),
  });

  await assert.rejects(
    runMutation(
      "item-add",
      "order-d",
      {},
      actor,
      { idempotencyKey: "idempotency-key-d", correlationId: "request-d" },
      async () => "written",
      async () => "replayed",
    ),
    (error: unknown) => error instanceof ConflictException,
  );
});
