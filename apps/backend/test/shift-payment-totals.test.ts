import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { ShiftsService } from "../src/modules/shifts/shifts.service";

test("smena hisobotida Uzcard va Humo terminalga, naqd esa kassaga yoziladi", () => {
  const service = new ShiftsService({} as never);
  const calculate = (
    service as unknown as {
      calculateShiftTotals: (
        payments: {
          amount: Prisma.Decimal;
          method: { code: string };
        }[],
        cashTransactions: never[],
        orderCount: number,
      ) => Record<string, Prisma.Decimal | number>;
    }
  ).calculateShiftTotals.bind(service);
  const totals = calculate(
    [
      { amount: new Prisma.Decimal(10000), method: { code: "CASH" } },
      { amount: new Prisma.Decimal(20000), method: { code: "CARD" } },
      { amount: new Prisma.Decimal(30000), method: { code: "UZCARD" } },
      { amount: new Prisma.Decimal(40000), method: { code: "HUMO" } },
      { amount: new Prisma.Decimal(5000), method: { code: "CLICK" } },
      { amount: new Prisma.Decimal(7000), method: { code: "ONLINE" } },
    ],
    [],
    6,
  );

  assert.equal((totals.cashTotal as Prisma.Decimal).toFixed(0), "10000");
  assert.equal((totals.terminalTotal as Prisma.Decimal).toFixed(0), "90000");
  assert.equal((totals.clickTotal as Prisma.Decimal).toFixed(0), "5000");
  assert.equal((totals.otherPaymentTotal as Prisma.Decimal).toFixed(0), "7000");
  assert.equal(totals.orderCount, 6);
});

test("keyingi smenadagi refund avvalgi smena naqd tushumini qayta qo'shmaydi", async () => {
  const shiftState: Record<string, unknown> = {
    id: "shift-b",
    branchId: "branch-a",
    employeeId: "employee-a",
    status: "OPEN",
    openingBalance: new Prisma.Decimal(50_000),
  };
  let closeData: Record<string, unknown> | undefined;
  const tx = {
    $queryRawUnsafe: async () => [],
    shift: {
      findUnique: async () => ({ ...shiftState }),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        closeData = data;
        Object.assign(shiftState, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...shiftState }),
    },
    employee: { findFirst: async () => ({ id: "employee-a" }) },
    cashTransfer: { findFirst: async () => null },
    payment: {
      findMany: async (args: {
        where: {
          revenueRecords: {
            some: { shiftId: string; source: string };
          };
        };
      }) => {
        assert.deepEqual(args.where.revenueRecords.some, {
          shiftId: "shift-b",
          source: "ORDER",
        });
        return [];
      },
    },
    cashTransaction: {
      findMany: async () => [
        { type: "REFUND", amount: new Prisma.Decimal(24_000) },
      ],
      create: async () => ({ id: "closing-row-b" }),
    },
    order: {
      count: async (args: {
        where: { revenueRecords: { some: { shiftId: string } } };
      }) => {
        assert.deepEqual(args.where.revenueRecords.some, {
          shiftId: "shift-b",
        });
        return 1;
      },
    },
  };
  const prisma = {
    $transaction: async <T>(callback: (database: typeof tx) => Promise<T>) =>
      callback(tx),
  };
  const service = new ShiftsService(prisma as never);

  await service.closeShift(
    "shift-b",
    { closingBalance: 26_000 },
    {
      id: "cashier-a",
      employeeId: "employee-a",
      branchId: "branch-a",
      tenantId: "tenant-a",
      membershipId: "membership-a",
      isGlobalScope: false,
      roles: ["CASHIER"],
      permissions: ["SHIFT_CLOSE"],
    },
  );

  assert.ok(closeData);
  assert.equal((closeData.expectedCash as Prisma.Decimal).toFixed(0), "26000");
  assert.equal((closeData.cashTotal as Prisma.Decimal).toFixed(0), "0");
  assert.equal((closeData.refundsTotal as Prisma.Decimal).toFixed(0), "24000");
  assert.equal((closeData.salesTotal as Prisma.Decimal).toFixed(0), "0");
  assert.equal(closeData.orderCount, 1);
  assert.equal((closeData.cashDifference as Prisma.Decimal).toFixed(0), "0");
});
