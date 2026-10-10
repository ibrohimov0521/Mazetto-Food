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
) {
  const service = new CashRegisterService(
    {
      branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
      shift: {
        findFirst: async () => ({
          id: "shift-a",
          branchId: "branch-a",
          employeeId: "employee-a",
          openingBalance: new Prisma.Decimal(openingBalance),
          cashTransactions: cashTransactions.map((transaction) => ({
            ...transaction,
            amount: new Prisma.Decimal(transaction.amount),
          })),
          revenueRecords: [],
        }),
      },
    } as never,
    {} as never,
  );

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
