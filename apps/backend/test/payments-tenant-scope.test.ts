import assert from "node:assert/strict";
import test from "node:test";
import { PaymentStatus, Prisma } from "@prisma/client";
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
            {
              branchId: "branch-a",
              code: "CASH",
              name: "Filial naqd",
              sortOrder: 1,
              isActive: true,
            },
            {
              branchId: null,
              code: "CASH",
              name: "Umumiy naqd",
              sortOrder: 2,
              isActive: true,
            },
            {
              branchId: "branch-a",
              code: "CLICK",
              name: "Filial Click",
              sortOrder: 3,
              isActive: false,
            },
            {
              branchId: null,
              code: "CLICK",
              name: "Umumiy Click",
              sortOrder: 4,
              isActive: true,
            },
            {
              branchId: null,
              code: "PAYME",
              name: "Payme",
              sortOrder: 5,
              isActive: true,
            },
            {
              branchId: null,
              code: "UNKNOWN",
              name: "Noma'lum",
              sortOrder: 6,
              isActive: true,
            },
          ];
        },
      },
    } as never,
    { getCsv: async () => ["CASH", "CLICK", "UNKNOWN"] } as never,
  );

  const methods = await service.listPaymentMethods(cashier);

  assert.deepEqual(methodWhere, {
    OR: [{ branchId: "branch-a" }, { branchId: null }],
  });
  assert.deepEqual(methods, [
    { code: "CASH", name: "Filial naqd" },
  ]);
});

test("stale global method ID cannot bypass a disabled branch override", async () => {
  const service = new PaymentsService({} as never);
  const lookups: Record<string, unknown>[] = [];
  const tx = {
    paymentMethod: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        lookups.push(args.where);
        if (args.where.id === "global-card") {
          return { code: "CARD" };
        }
        if (args.where.branchId === "branch-a") {
          return {
            id: "branch-card",
            code: "CARD",
            name: "Filial karta",
            isActive: false,
          };
        }
        return { id: "global-card", code: "CARD", name: "Karta" };
      },
    },
  };
  const resolve = (
    service as unknown as {
      resolvePaymentMethod: (
        transaction: object,
        branchId: string,
        tender: { paymentMethodId: string },
      ) => Promise<{ id: string }>;
    }
  ).resolvePaymentMethod.bind(service);

  await assert.rejects(
    resolve(tx, "branch-a", { paymentMethodId: "global-card" }),
    /bu filialda mavjud emas/,
  );
  assert.equal(lookups.length, 2);
});

test("disabled payment method cannot be collected against an existing order", async () => {
  let orderReads = 0;
  let paymentWrites = 0;
  let revenueWrites = 0;
  let settingsReadClient: unknown;
  const order = {
    id: "order-a",
    branchId: "branch-a",
    total: new Prisma.Decimal(10000),
    status: "READY",
    source: "WEB",
    payments: [],
    receipts: [],
  };
  const transaction = {
    $executeRaw: async () => 1,
    order: {
      findFirst: async () => {
        orderReads += 1;
        return orderReads === 1 ? { id: order.id } : order;
      },
    },
    paymentOperation: {
      findUnique: async () => null,
      create: async () => ({ id: "operation-a" }),
    },
    employee: { findFirst: async () => ({ id: "employee-a" }) },
    paymentMethod: {
      findFirst: async () => ({
        id: "click-method",
        code: "CLICK",
        name: "Click",
        isActive: true,
      }),
    },
    payment: {
      create: async () => {
        paymentWrites += 1;
        throw new Error("Disabled method must not create a payment");
      },
    },
    revenueRecord: {
      create: async () => {
        revenueWrites += 1;
        throw new Error("Disabled method must not create revenue");
      },
    },
  };
  const service = new PaymentsService(
    { ...tenantLookup } as never,
    {
      getCsv: async (_key: string, _tenantId: string, client?: unknown) => {
        settingsReadClient = client;
        return ["CASH"];
      },
    } as never,
  );

  await assert.rejects(
    service.processOrderPayment(
      {
        orderId: order.id,
        idempotencyKey: "disabled-click-existing-order",
        payments: [{ paymentMethodCode: "CLICK", amount: 10000 }],
      } as never,
      cashier,
      undefined,
      undefined,
      undefined,
      transaction as never,
    ),
    /CLICK payment provider is not enabled/,
  );
  assert.equal(paymentWrites, 0);
  assert.equal(revenueWrites, 0);
  assert.equal(settingsReadClient, transaction);
});

test("disabled payment method does not block replay of a completed payment", async () => {
  const dto = {
    orderId: "order-a",
    idempotencyKey: "completed-click-payment",
    payments: [{ paymentMethodCode: "CLICK", amount: 10000 }],
  };
  let settingsReads = 0;
  const service = new PaymentsService(
    { ...tenantLookup } as never,
    {
      getCsv: async () => {
        settingsReads += 1;
        return ["CASH"];
      },
    } as never,
  );
  const requestHash = (
    service as unknown as {
      createRequestHash: (
        request: typeof dto,
        status: PaymentStatus,
        reference: undefined,
        employeeId: string,
      ) => string;
    }
  ).createRequestHash(dto, PaymentStatus.SUCCESS, undefined, "employee-a");
  const operation = {
    id: "operation-a",
    orderId: dto.orderId,
    idempotencyKey: dto.idempotencyKey,
    requestHash,
    status: "COMPLETED",
    completedAt: new Date("2026-10-11T10:00:00.000Z"),
  };
  let paymentWrites = 0;
  let methodReads = 0;
  const transaction = {
    order: {
      findFirst: async () => ({ id: dto.orderId, branchId: "branch-a" }),
      findUnique: async () => ({ id: dto.orderId }),
    },
    employee: { findFirst: async () => ({ id: "employee-a" }) },
    paymentOperation: { findUnique: async () => operation },
    payment: {
      findMany: async () => [],
      create: async () => {
        paymentWrites += 1;
        throw new Error("A completed replay must not create another payment");
      },
    },
    paymentMethod: {
      findFirst: async () => {
        methodReads += 1;
        throw new Error("A completed replay must not resolve a new method");
      },
    },
  };

  const result = await service.processOrderPayment(
    dto as never,
    cashier,
    undefined,
    undefined,
    undefined,
    transaction as never,
  );

  assert.equal(result.operation?.id, operation.id);
  assert.equal(result.order?.id, dto.orderId);
  assert.equal(paymentWrites, 0);
  assert.equal(methodReads, 0);
  assert.equal(settingsReads, 0);
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

test("same-tenant foreign-branch order is rejected before replay lookup", async () => {
  let operationReads = 0;
  const transaction = {
    order: {
      findFirst: async () => ({ id: "order-b", branchId: "branch-b" }),
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
        idempotencyKey: "same-tenant-foreign-branch-key",
        payments: [{ paymentMethodCode: "CASH", amount: 1000 }],
      } as never,
      cashier,
      undefined,
      undefined,
      undefined,
      transaction as never,
    ),
    /Boshqa filialga kirish huquqi yo'q/,
  );
  assert.equal(operationReads, 0);
});

test("inactive employee cannot replay a completed payment operation", async () => {
  let operationReads = 0;
  const transaction = {
    order: {
      findFirst: async () => ({ id: "order-a", branchId: "branch-a" }),
    },
    paymentOperation: {
      findUnique: async () => {
        operationReads += 1;
        return {
          id: "operation-a",
          orderId: "order-a",
          requestHash: "existing-hash",
          status: "COMPLETED",
        };
      },
    },
    employee: { findFirst: async () => null },
  };
  const service = new PaymentsService({
    ...tenantLookup,
  } as never);

  await assert.rejects(
    service.processOrderPayment(
      {
        orderId: "order-a",
        idempotencyKey: "completed-operation-key",
        payments: [{ paymentMethodCode: "CASH", amount: 1000 }],
      } as never,
      cashier,
      undefined,
      undefined,
      undefined,
      transaction as never,
    ),
    /Employee is not active in this branch/,
  );
  assert.equal(operationReads, 1);
});

test("unique-key replay fallback enforces branch scope before returning details", async () => {
  let resultReads = 0;
  const service = new PaymentsService({
    ...tenantLookup,
    paymentOperation: {
      findFirst: async () => ({
        id: "operation-b",
        orderId: "order-b",
        requestHash: "matching-hash",
        status: "COMPLETED",
        order: { branchId: "branch-b" },
      }),
    },
    employee: {
      findFirst: async () => ({ id: "employee-a" }),
    },
    $transaction: async () => {
      resultReads += 1;
      return {};
    },
  } as never);
  const internal = service as unknown as {
    resolveExistingOperationByKey: (
      key: string,
      hash: string,
      tenantId: string,
      user: AuthenticatedUser,
      employeeId: string,
    ) => Promise<unknown>;
  };

  await assert.rejects(
    internal.resolveExistingOperationByKey(
      "same-tenant-foreign-branch-key",
      "matching-hash",
      "tenant-a",
      cashier,
      "employee-a",
    ),
    /Boshqa filialga kirish huquqi yo'q/,
  );
  assert.equal(resultReads, 0);
});

test("cashier cannot collect more than the balance after a partial refund", async () => {
  const order = {
    id: "order-a",
    branchId: "branch-a",
    total: new Prisma.Decimal(74000),
    status: "COMPLETED",
    source: "WEB",
    payments: [
      {
        amount: new Prisma.Decimal(74000),
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunds: [{ amount: new Prisma.Decimal(24000) }],
      },
    ],
    receipts: [],
  };
  let orderReads = 0;
  let paymentMethodLookup = false;
  const transaction = {
    $executeRaw: async () => 1,
    order: {
      findFirst: async () => {
        orderReads += 1;
        return orderReads === 1 ? { id: order.id } : order;
      },
    },
    paymentOperation: {
      findUnique: async () => null,
      create: async () => ({ id: "operation-a" }),
    },
    shift: {
      findFirst: async () => ({ id: "shift-a" }),
      updateMany: async () => ({ count: 1 }),
    },
    employee: { findFirst: async () => ({ id: "employee-a" }) },
    paymentMethod: {
      findFirst: async () => {
        paymentMethodLookup = true;
        throw new Error("Payment method lookup should not be reached");
      },
    },
  };
  const service = new PaymentsService({ ...tenantLookup } as never);

  await assert.rejects(
    service.processOrderPayment(
      {
        orderId: "order-a",
        shiftId: "shift-a",
        idempotencyKey: "refund-balance-overpayment",
        payments: [{ paymentMethodCode: "CASH", amount: 50000 }],
      } as never,
      cashier,
      undefined,
      undefined,
      undefined,
      transaction as never,
    ),
    /Payment amount exceeds outstanding balance/,
  );
  assert.equal(paymentMethodLookup, false);
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
