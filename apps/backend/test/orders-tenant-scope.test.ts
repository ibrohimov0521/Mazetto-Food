import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { OrdersService } from "../src/modules/orders/orders.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

function createService(prisma: object): OrdersService {
  return new OrdersService(prisma as never, {} as never, {} as never);
}

function activeTenant() {
  return {
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
  };
}

test("order listing is always filtered to the resolved restaurant tenant", async () => {
  let where: Record<string, unknown> | undefined;
  const service = createService({
    ...activeTenant(),
    order: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        where = args.where;
        return [];
      },
    },
  });

  await service.listOrders({} as never, owner);

  assert.deepEqual(where?.branch, { tenantId: "tenant-a" });
});

test("foreign tenant order details are hidden as not found", async () => {
  let where: unknown;
  const service = createService({
    ...activeTenant(),
    order: {
      findFirst: async (args: { where: unknown }) => {
        where = args.where;
        return null;
      },
    },
  });

  await assert.rejects(service.getOrder("order-b", owner), /Order not found/);
  assert.deepEqual(where, {
    id: "order-b",
    branch: { tenantId: "tenant-a" },
  });
});

test("bulk deletion does not start for IDs outside the actor tenant", async () => {
  let where: unknown;
  let transactionStarted = false;
  const service = createService({
    ...activeTenant(),
    order: {
      findMany: async (args: { where: unknown }) => {
        where = args.where;
        return [];
      },
    },
    $transaction: async () => {
      transactionStarted = true;
    },
  });

  await assert.rejects(
    service.permanentlyDeleteOrders(["order-b"], owner),
    /Tanlangan buyurtmalarning biri topilmadi/,
  );
  assert.deepEqual(where, {
    id: { in: ["order-b"] },
    branch: { tenantId: "tenant-a" },
  });
  assert.equal(transactionStarted, false);
});

test("bulk deletion rechecks tenant scope inside the transaction", async () => {
  let transactionWhere: unknown;
  let dependentReads = 0;
  const transaction = {
    order: {
      findMany: async (args: { where: unknown }) => {
        transactionWhere = args.where;
        return [];
      },
    },
    payment: {
      findMany: async () => {
        dependentReads += 1;
        return [];
      },
    },
  };
  const service = createService({
    ...activeTenant(),
    order: {
      findMany: async () => [
        { id: "order-a", branchId: "branch-a", orderNumber: "A-1" },
      ],
    },
    $transaction: async (callback: (tx: object) => Promise<unknown>) =>
      callback(transaction),
  });

  await assert.rejects(
    service.permanentlyDeleteOrders(["order-a"], owner),
    /Tanlangan buyurtmalarning biri topilmadi/,
  );
  assert.deepEqual(transactionWhere, {
    id: { in: ["order-a"] },
    branch: { tenantId: "tenant-a" },
  });
  assert.equal(dependentReads, 0);
});

test("POS replay checks branch tenant scope before reading the idempotency operation", async () => {
  const cashier: AuthenticatedUser = {
    id: "cashier-a",
    employeeId: "employee-a",
    branchId: "branch-a",
    roles: ["CASHIER"],
    permissions: ["POS_USE"],
  };
  let operationReads = 0;
  const transaction = {
    branch: {
      findUnique: async () => ({ tenantId: "tenant-a" }),
      findFirst: async () => null,
    },
    paymentOperation: {
      findUnique: async () => {
        operationReads += 1;
        return { id: "operation-b", orderId: "order-b" };
      },
    },
  };
  const service = createService({
    $transaction: async (callback: (tx: object) => Promise<unknown>) =>
      callback(transaction),
  });

  await assert.rejects(
    service.createPosCheckout({
      idempotencyKey: "foreign-replay-key",
      cashReceived: 25000,
      items: [{ productId: "product-a", quantity: 1 }],
    } as never, cashier),
    /Branch not found/,
  );
  assert.equal(operationReads, 0);
});
test("forced status scopes the order lookup to the actor tenant", async () => {
  let where: unknown;
  let unscopedReads = 0;
  const transaction = {
    $queryRaw: async () => [],
    ...activeTenant(),
    order: {
      findFirst: async (args: { where: unknown }) => {
        where = args.where;
        return null;
      },
      findUnique: async () => {
        unscopedReads += 1;
        return { id: "order-b", branchId: "branch-b" };
      },
    },
  };
  const service = createService({
    $transaction: async (callback: (tx: object) => Promise<unknown>) =>
      callback(transaction),
  });

  await assert.rejects(
    service.updateStatus(
      "order-b",
      { status: "CANCELLED", force: true } as never,
      owner,
    ),
    /Order not found/,
  );
  assert.deepEqual(where, {
    id: "order-b",
    branch: { tenantId: "tenant-a" },
  });
  assert.equal(unscopedReads, 0);
});
