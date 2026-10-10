import assert from "node:assert/strict";
import test from "node:test";
import { CashTransactionType, Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { CashRegisterService } from "../src/modules/cash-register/cash-register.service";

const cashier: AuthenticatedUser = {
  id: "cashier-a",
  employeeId: "employee-a",
  branchId: "branch-a",
  roles: ["CASHIER"],
  permissions: ["SHIFT_VIEW_OWN"],
};

async function getCurrentCash(
  openingBalance: number,
  cashTransactions: { amount: number; type: CashTransactionType }[],
  revenueRecords: {
    orderId: string | null;
    amount: number;
    methodCode: string | null;
  }[] = [],
  directlyAssignedOrderIds: string[] = [],
  captured?: {
    shiftQuery?: Record<string, unknown>;
    cashTransactionQuery?: Record<string, unknown>;
    cashSalesQuery?: Record<string, unknown>;
    shiftOrdersQuery?: Record<string, unknown>;
    transactionOptions?: Record<string, unknown>;
  },
) {
  const totals = new Map<CashTransactionType, { amount: Prisma.Decimal; count: number }>();
  for (const transaction of cashTransactions) {
    const total = totals.get(transaction.type) ?? {
      amount: new Prisma.Decimal(0),
      count: 0,
    };
    total.amount = total.amount.add(transaction.amount);
    total.count += 1;
    totals.set(transaction.type, total);
  }
  const db = {
    branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
    shift: {
      findFirst: async (query: Record<string, unknown>) => {
        if (captured) captured.shiftQuery = query;
        return {
          id: "shift-a",
          branchId: "branch-a",
          employeeId: "employee-a",
          openingBalance: new Prisma.Decimal(openingBalance),
          cashTransactions: cashTransactions.slice(0, 50).map((transaction) => ({
            ...transaction,
            amount: new Prisma.Decimal(transaction.amount),
          })),
        };
      },
    },
    cashTransaction: {
      groupBy: async (query: Record<string, unknown>) => {
        if (captured) captured.cashTransactionQuery = query;
        return [...totals].map(([type, total]) => ({
          type,
          _sum: { amount: total.amount },
          _count: { _all: total.count },
        }));
      },
    },
    revenueRecord: {
      aggregate: async (query: Record<string, unknown>) => {
        if (captured) captured.cashSalesQuery = query;
        return {
          _sum: {
            amount: revenueRecords
              .filter((record) => record.orderId && record.methodCode === "CASH")
              .reduce((total, record) => total.add(record.amount), new Prisma.Decimal(0)),
          },
        };
      },
    },
    order: {
      findMany: async (query: Record<string, unknown>) => {
        if (captured) captured.shiftOrdersQuery = query;
        return [...new Set([
          ...directlyAssignedOrderIds,
          ...revenueRecords
            .filter((record) => record.orderId && record.methodCode)
            .map((record) => record.orderId as string),
        ])]
          .sort()
          .map((id) => ({ id }));
      },
    },
  };
  const prisma = {
    ...db,
    $transaction: async (
      operation: (tx: typeof db) => Promise<unknown>,
      options: Record<string, unknown>,
    ) => {
      if (captured) captured.transactionOptions = options;
      return operation(db);
    },
  };
  const service = new CashRegisterService(prisma as never, {} as never);

  return service.getCurrentShift(cashier);
}

test("current shift balance includes the opening float for a legacy shift without an opening ledger row", async () => {
  const shift = await getCurrentCash(100000, [
    { amount: 25000, type: CashTransactionType.SALE },
    { amount: 10000, type: CashTransactionType.EXPENSE },
  ]);

  assert.equal(shift?.currentBalance.toFixed(0), "115000");
});

test("current shift balance does not count the opening float twice when its ledger row exists", async () => {
  const shift = await getCurrentCash(100000, [
    { amount: 100000, type: CashTransactionType.OPENING_BALANCE },
    { amount: 25000, type: CashTransactionType.SALE },
    { amount: 10000, type: CashTransactionType.EXPENSE },
  ]);

  assert.equal(shift?.currentBalance.toFixed(0), "115000");
});

test("current shift summary counts direct and paid orders without loading full ledger history", async () => {
  const captured: {
    shiftQuery?: Record<string, unknown>;
    cashTransactionQuery?: Record<string, unknown>;
    cashSalesQuery?: Record<string, unknown>;
    shiftOrdersQuery?: Record<string, unknown>;
    transactionOptions?: Record<string, unknown>;
  } = {};
  const shift = await getCurrentCash(
    50000,
    [
      { amount: 20000, type: CashTransactionType.SALE },
      { amount: 5000, type: CashTransactionType.REFUND },
    ],
    [
      { orderId: "order-a", amount: 30000, methodCode: "CASH" },
      { orderId: "order-a", amount: 10000, methodCode: "CASH" },
      { orderId: "order-b", amount: 25000, methodCode: "UZCARD" },
      { orderId: "unpaid", amount: 10000, methodCode: null },
    ],
    ["order-c"],
    captured,
  );

  assert.equal(shift?.currentBalance.toFixed(0), "65000");
  assert.equal(shift?.cashSales.toFixed(0), "40000");
  assert.equal(shift?.orderCount, 3);
  assert.deepEqual(shift?.revenueRecords, [
    { orderId: "order-a" },
    { orderId: "order-b" },
    { orderId: "order-c" },
  ]);
  const include = captured.shiftQuery?.include as {
    cashTransactions: Record<string, unknown>;
  };
  assert.equal(include.cashTransactions.take, 50);
  assert.equal("revenueRecords" in include, false);
  assert.deepEqual(captured.cashTransactionQuery, {
    by: ["type"],
    where: { shiftId: "shift-a" },
    _sum: { amount: true },
    _count: { _all: true },
  });
  assert.deepEqual(captured.cashSalesQuery, {
    where: {
      shiftId: "shift-a",
      payment: { method: { code: "CASH" } },
    },
    _sum: { amount: true },
  });
  assert.deepEqual(captured.shiftOrdersQuery, {
    where: {
      OR: [
        { shiftId: "shift-a" },
        {
          revenueRecords: {
            some: {
              shiftId: "shift-a",
              paymentId: { not: null },
            },
          },
        },
      ],
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  assert.deepEqual(captured.transactionOptions, {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
});

test("cashier can read their own shift order history with requested filters", async () => {
  const captured: { orderQuery?: Record<string, unknown> } = {};
  const service = new CashRegisterService(
    {
      branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
      shift: {
        findFirst: async () => ({
          id: "shift-a",
          branchId: "branch-a",
          employeeId: "employee-a",
        }),
      },
      order: {
        findMany: async (query: Record<string, unknown>) => {
          captured.orderQuery = query;
          return [];
        },
      },
    } as never,
    {} as never,
  );

  assert.deepEqual(
    await service.getShiftOrders(
      "shift-a",
      { status: "CANCELLED", search: "WEB101", limit: "20", offset: "40" },
      cashier,
    ),
    [],
  );
  const where = captured.orderQuery?.where as Record<string, unknown>;
  assert.deepEqual(where.AND, [{
    OR: [
      { shiftId: "shift-a" },
      { revenueRecords: { some: { shiftId: "shift-a" } } },
    ],
  }]);
  assert.equal(where.branchId, "branch-a");
  assert.deepEqual(where.branch, { tenantId: "tenant-a" });
  assert.ok(Array.isArray(where.OR), "Search must not replace the shift membership condition");
  assert.deepEqual(captured.orderQuery?.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  const include = captured.orderQuery?.include as { payments: { include: { refunds: unknown } } };
  assert.deepEqual(include.payments.include.refunds, {
    select: { id: true, orderItemId: true, amount: true, reason: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(captured.orderQuery?.skip, 40);
  assert.equal(captured.orderQuery?.take, 20);
  assert.equal(
    ((captured.orderQuery?.where as { status: string }).status),
    "CANCELLED",
  );
});

test("cashier cannot read another employee's shift orders", async () => {
  let queriedOrders = false;
  const service = new CashRegisterService(
    {
      branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
      shift: {
        findFirst: async () => ({
          id: "shift-b",
          branchId: "branch-a",
          employeeId: "employee-b",
        }),
      },
      order: {
        findMany: async () => {
          queriedOrders = true;
          return [];
        },
      },
    } as never,
    {} as never,
  );

  await assert.rejects(
    service.getShiftOrders("shift-b", {}, cashier),
    /Cannot access another employee shift/,
  );
  assert.equal(queriedOrders, false);
});

test("cashier shift history only requests their own tenant-scoped shifts", async () => {
  const captured: { shiftQuery?: Record<string, unknown> } = {};
  const service = new CashRegisterService(
    {
      branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
      shift: {
        findMany: async (query: Record<string, unknown>) => {
          captured.shiftQuery = query;
          return [{ id: "shift-a", orderCount: 0, _count: { orders: 1 } }];
        },
      },
    } as never,
    {} as never,
  );

  const shifts = await service.listOwnShifts({ limit: "25", offset: "50" }, cashier);
  assert.deepEqual(captured.shiftQuery?.where, {
    employeeId: "employee-a",
    branch: { tenantId: "tenant-a" },
  });
  assert.equal(captured.shiftQuery?.take, 25);
  assert.equal(captured.shiftQuery?.skip, 50);
  assert.deepEqual(captured.shiftQuery?.select && (captured.shiftQuery?.select as Record<string, unknown>)._count, { select: { orders: true } });
  assert.equal(shifts[0]?.orderCount, 1);
});

test("shift cash transaction history returns a stable, paginated page and exact total", async () => {
  const captured: {
    transactionQuery?: Record<string, unknown>;
    countWhere?: unknown;
  } = {};
  const rows = [{ id: "transaction-101" }];
  const service = new CashRegisterService(
    {
      branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
      shift: {
        findFirst: async () => ({
          id: "shift-a",
          branchId: "branch-a",
          employeeId: "employee-a",
        }),
      },
      cashTransaction: {
        findMany: async (query: Record<string, unknown>) => {
          captured.transactionQuery = query;
          return rows;
        },
        count: async ({ where }: { where: unknown }) => {
          captured.countWhere = where;
          return 101;
        },
      },
    } as never,
    {} as never,
  );

  assert.deepEqual(
    await service.getTransactions(
      "shift-a",
      { limit: "500", offset: "50" },
      cashier,
    ),
    { items: rows, total: 101 },
  );
  assert.deepEqual(captured.transactionQuery?.where, { shiftId: "shift-a" });
  assert.deepEqual(captured.transactionQuery?.orderBy, [
    { occurredAt: "desc" },
    { id: "desc" },
  ]);
  assert.equal(captured.transactionQuery?.skip, 50);
  assert.equal(captured.transactionQuery?.take, 100);
  assert.deepEqual(captured.countWhere, { shiftId: "shift-a" });
});

test("cash transaction history keeps the legacy array response without page parameters", async () => {
  const captured: { transactionQuery?: Record<string, unknown> } = {};
  const rows = [{ id: "legacy-transaction" }];
  const service = new CashRegisterService(
    {
      branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
      shift: {
        findFirst: async () => ({
          id: "shift-a",
          branchId: "branch-a",
          employeeId: "employee-a",
        }),
      },
      cashTransaction: {
        findMany: async (query: Record<string, unknown>) => {
          captured.transactionQuery = query;
          return rows;
        },
      },
    } as never,
    {} as never,
  );

  assert.deepEqual(await service.getTransactions("shift-a", {}, cashier), rows);
  assert.equal(captured.transactionQuery?.take, 200);
  assert.equal(captured.transactionQuery?.skip, undefined);
  assert.deepEqual(captured.transactionQuery?.orderBy, [
    { occurredAt: "desc" },
    { id: "desc" },
  ]);
});

test("cash transaction history returns an empty page for an unknown shift", async () => {
  let queriedTransactions = false;
  const service = new CashRegisterService(
    {
      branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
      shift: { findFirst: async () => null },
      cashTransaction: {
        findMany: async () => {
          queriedTransactions = true;
          return [];
        },
        count: async () => {
          queriedTransactions = true;
          return 0;
        },
      },
    } as never,
    {} as never,
  );

  assert.deepEqual(
    await service.getTransactions("missing-shift", { limit: "50" }, cashier),
    { items: [], total: 0 },
  );
  assert.equal(queriedTransactions, false);
});

test("branch shift viewers can open a historical shift within their tenant", async () => {
  const captured: { shiftQuery?: Record<string, unknown> } = {};
  const manager: AuthenticatedUser = {
    ...cashier,
    employeeId: "manager-a",
    roles: ["BRANCH_MANAGER"],
    permissions: ["SHIFT_VIEW_BRANCH"],
  };
  const service = new CashRegisterService(
    {
      branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
      shift: {
        findFirst: async (query: Record<string, unknown>) => {
          captured.shiftQuery = query;
          return {
            id: "shift-old",
            employeeId: "employee-a",
            branchId: "branch-a",
            status: "CLOSED",
            shiftNumber: 12,
            orderCount: 0,
            _count: { orders: 7 },
          };
        },
      },
    } as never,
    {} as never,
  );

  const shift = await service.getShiftHistoryDetail("shift-old", manager);
  assert.equal(shift.status, "CLOSED");
  assert.equal(shift.orderCount, 7);
  assert.deepEqual(captured.shiftQuery?.where, {
    id: "shift-old",
    branch: { tenantId: "tenant-a" },
  });
});

test("shift history sorts before pagination and safely ignores unknown sort values", async () => {
  for (const [sort, orderBy] of [
    ["amount-high", [{ total: "desc" }, { id: "desc" }]],
    ["amount-low", [{ total: "asc" }, { id: "asc" }]],
    ["oldest", [{ createdAt: "asc" }, { id: "asc" }]],
    ["untrusted-column", [{ createdAt: "desc" }, { id: "desc" }]],
  ] as const) {
    let captured: unknown;
    const service = new CashRegisterService({
      branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
      shift: { findFirst: async () => ({ id: "shift-a", branchId: "branch-a", employeeId: "employee-a" }) },
      order: { findMany: async (query: unknown) => { captured = query; return []; } },
    } as never, {} as never);
    await service.getShiftOrders("shift-a", { sort, limit: "20", offset: "100" }, cashier);
    assert.deepEqual((captured as { orderBy: unknown }).orderBy, orderBy);
    assert.equal((captured as { skip: number }).skip, 100);
  }
});
