import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ShiftsService } from "../src/modules/shifts/shifts.service";

const cashier: AuthenticatedUser = {
  id: "cashier-a",
  employeeId: "employee-a",
  branchId: "branch-a",
  isGlobalScope: false,
  roles: ["CASHIER"],
  permissions: ["CASH_TRANSACTION_CREATE"],
};

function createHarness(
  options: {
    order?: { id: string } | null;
    payment?: { id: string; orderId: string } | null;
  } = {},
) {
  let orderWhere: unknown;
  let paymentWhere: unknown;
  let writes = 0;
  const transaction = {
    branch: {
      findUnique: async () => ({ tenantId: "tenant-a" }),
      findFirst: async () => ({ id: "branch-a" }),
    },
    shift: {
      findUnique: async () => ({
        id: "shift-a",
        branchId: "branch-a",
        employeeId: "employee-a",
        status: "OPEN",
      }),
      updateMany: async () => ({ count: 1 }),
    },
    employee: { findFirst: async () => ({ id: "employee-a" }) },
    order: {
      findFirst: async (args: { where: unknown }) => {
        orderWhere = args.where;
        return options.order ?? null;
      },
    },
    payment: {
      findFirst: async (args: { where: unknown }) => {
        paymentWhere = args.where;
        return options.payment ?? null;
      },
    },
    cashTransaction: {
      create: async () => {
        writes += 1;
        return { id: "cash-transaction-a" };
      },
    },
  };
  const prisma = {
    ...transaction,
    $transaction: async (callback: (tx: object) => Promise<unknown>) =>
      callback(transaction),
  };

  return {
    service: new ShiftsService(prisma as never),
    get orderWhere() {
      return orderWhere;
    },
    get paymentWhere() {
      return paymentWhere;
    },
    get writes() {
      return writes;
    },
  };
}

test("cash transaction rejects an order outside the cashier branch before writing", async () => {
  const harness = createHarness();
  await assert.rejects(
    harness.service.createCashTransaction(
      "shift-a",
      {
        type: "INCOME",
        amount: 500,
        orderId: "order-b",
      } as never,
      cashier,
    ),
    /Order not found/,
  );
  assert.deepEqual(harness.orderWhere, {
    id: "order-b",
    branchId: "branch-a",
    branch: { tenantId: "tenant-a" },
  });
  assert.equal(harness.writes, 0);
});

test("cash transaction rejects a payment outside the cashier branch before writing", async () => {
  const harness = createHarness();
  await assert.rejects(
    harness.service.createCashTransaction(
      "shift-a",
      {
        type: "INCOME",
        amount: 500,
        paymentId: "payment-b",
      } as never,
      cashier,
    ),
    /Payment not found/,
  );
  assert.deepEqual(harness.paymentWhere, {
    id: "payment-b",
    order: { branchId: "branch-a", branch: { tenantId: "tenant-a" } },
  });
  assert.equal(harness.writes, 0);
});

test("cash transaction rejects an order and payment pair that do not match", async () => {
  const harness = createHarness({
    order: { id: "order-a" },
    payment: { id: "payment-a", orderId: "order-b" },
  });
  await assert.rejects(
    harness.service.createCashTransaction(
      "shift-a",
      {
        type: "INCOME",
        amount: 500,
        orderId: "order-a",
        paymentId: "payment-a",
      } as never,
      cashier,
    ),
    /Payment does not belong to order/,
  );
  assert.equal(harness.writes, 0);
});
