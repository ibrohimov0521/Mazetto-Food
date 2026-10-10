import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { PaymentsService } from "../src/modules/payments/payments.service";

const cashier: AuthenticatedUser = {
  id: "cashier-a",
  employeeId: "employee-a",
  branchId: "branch-a",
  isGlobalScope: false,
  roles: ["CASHIER"],
  permissions: ["PAYMENT_VIEW", "PAYMENT_CREATE", "PAYMENT_REFUND"],
};

const tenantLookup = {
  branch: {
    findUnique: async () => ({ tenantId: "tenant-a" }),
  },
};

test("payment listing filters through the order tenant", async () => {
  let where: Record<string, unknown> | undefined;
  const service = new PaymentsService({
    ...tenantLookup,
    payment: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        where = args.where;
        return [];
      },
    },
  } as never);

  await service.listPayments({} as never, cashier);
  assert.deepEqual((where?.order as Record<string, unknown>).branch, {
    tenantId: "tenant-a",
  });
  assert.deepEqual(
    (where?.order as Record<string, unknown>).branchId,
    "branch-a",
  );
});

test("cashier payment method list follows tenant toggles and active methods", async () => {
  let methodWhere: Record<string, unknown> | undefined;
  const service = new PaymentsService(
    {
      ...tenantLookup,
      paymentMethod: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          methodWhere = args.where;
          return [
            { code: "CASH", name: "Naqd", sortOrder: 1 },
            { code: "CARD", name: "Karta", sortOrder: 2 },
            { code: "CLICK", name: "Click", sortOrder: 3 },
            { code: "PAYME", name: "Payme", sortOrder: 4 },
            { code: "UNKNOWN", name: "Noma'lum", sortOrder: 5 },
          ];
        },
      },
    } as never,
    { getCsv: async () => ["CASH", "CLICK", "UNKNOWN"] } as never,
  );

  const methods = await service.listPaymentMethods(cashier);

  assert.deepEqual(methodWhere, {
    isActive: true,
    OR: [{ branchId: "branch-a" }, { branchId: null }],
  });
  assert.deepEqual(methods, [
    { code: "CASH", name: "Naqd" },
    { code: "CLICK", name: "Click" },
  ]);
});

test("foreign order is rejected before an idempotency replay lookup", async () => {
  let operationReads = 0;
  let orderWhere: unknown;
  const transaction = {
    order: {
      findFirst: async (args: { where: unknown }) => {
        orderWhere = args.where;
        return null;
      },
    },
    paymentOperation: {
      findUnique: async () => {
        operationReads += 1;
        return { id: "operation-b" };
      },
    },
  };
  const service = new PaymentsService({
    ...tenantLookup,
  } as never);

  await assert.rejects(
    service.processOrderPayment(
      {
        orderId: "order-b",
        idempotencyKey: "foreign-key",
        payments: [{ paymentMethodCode: "CASH", amount: 1000 }],
      } as never,
      cashier,
      undefined,
      undefined,
      undefined,
      transaction as never,
    ),
    /Order not found/,
  );
  assert.deepEqual(orderWhere, {
    id: "order-b",
    branch: { tenantId: "tenant-a" },
  });
  assert.equal(operationReads, 0);
});

test("foreign payment is rejected before refund replay lookup", async () => {
  let refundReplayReads = 0;
  let paymentWhere: unknown;
  const transaction = {
    $executeRaw: async () => 1,
    payment: {
      findFirst: async (args: { where: unknown }) => {
        paymentWhere = args.where;
        return null;
      },
    },
    paymentRefund: {
      findUnique: async () => {
        refundReplayReads += 1;
        return { paymentId: "payment-b" };
      },
    },
  };
  const service = new PaymentsService({
    ...tenantLookup,
    $transaction: async (callback: (tx: object) => Promise<unknown>) =>
      callback(transaction),
  } as never);

  await assert.rejects(
    service.refundPayment(
      "payment-b",
      {
        shiftId: "shift-a",
        reason: "Test",
        idempotencyKey: "refund-key-b",
      } as never,
      cashier,
    ),
    /Payment not found/,
  );
  assert.deepEqual(paymentWhere, {
    id: "payment-b",
    order: { branch: { tenantId: "tenant-a" } },
  });
  assert.equal(refundReplayReads, 0);
});
