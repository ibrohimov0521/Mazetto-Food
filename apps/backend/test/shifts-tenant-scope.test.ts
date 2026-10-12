import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ShiftsService } from "../src/modules/shifts/shifts.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

test("shift list and cash-transfer detail are tenant filtered", async () => {
  const filters: Record<string, unknown>[] = [];
  const service = new ShiftsService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    shift: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.push(args.where);
        return [];
      },
    },
    cashTransfer: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        filters.push(args.where);
        return null;
      },
    },
  } as never);

  await service.listShifts({ offset: 0, limit: 20 }, owner);
  await assert.rejects(service.getCashTransferDetail("transfer-b", owner));
  assert.deepEqual(filters[0]?.branch, { tenantId: "tenant-a" });
  assert.deepEqual(filters[1]?.branch, { tenantId: "tenant-a" });
});

test("shift data is not queried when active tenant context is ambiguous", async () => {
  let shiftReads = 0;
  const service = new ShiftsService({
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
    },
    shift: {
      findMany: async () => {
        shiftReads += 1;
        return [];
      },
    },
  } as never);

  await assert.rejects(service.listShifts({ offset: 0, limit: 20 }, owner));
  assert.equal(shiftReads, 0);
});

test("shift list replaces stale stored order counts with legacy-aware counts", async () => {
  const service = new ShiftsService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    shift: {
      findMany: async () => [{
        id: "shift-old",
        status: "CLOSED",
        orderCount: 0,
      }],
    },
    $queryRaw: async () => [{ shiftId: "shift-old", orderCount: 6 }],
  } as never);

  const shifts = await service.listShifts({ offset: 0, limit: 20 }, owner);
  assert.equal(shifts[0]?.orderCount, 6);
});

test("shift list aggregates only open-shift cash transactions", async () => {
  let shiftQuery: Record<string, unknown> | undefined;
  let transactionQuery: Record<string, unknown> | undefined;
  const service = new ShiftsService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    shift: {
      findMany: async (query: Record<string, unknown>) => {
        shiftQuery = query;
        return [{
          id: "shift-open",
          branchId: "branch-a",
          status: "OPEN",
          openingBalance: new Prisma.Decimal(1000),
          orderCount: 0,
        }];
      },
    },
    cashTransaction: {
      groupBy: async (query: Record<string, unknown>) => {
        transactionQuery = query;
        return [
          { shiftId: "shift-open", type: "OPENING_BALANCE", _sum: { amount: 1000 } },
          { shiftId: "shift-open", type: "SALE", _sum: { amount: 500 } },
          { shiftId: "shift-open", type: "EXPENSE", _sum: { amount: 200 } },
        ];
      },
    },
    $queryRaw: async () => [],
  } as never);

  const shifts = await service.listShifts({ offset: 0, limit: 20 }, owner);
  assert.equal(shifts[0]?.currentCash?.toFixed(0), "1300");
  assert.equal(
    ((shiftQuery?.include as Record<string, unknown>)?.cashTransactions),
    undefined,
  );
  assert.deepEqual(transactionQuery?.by, ["shiftId", "type"]);
  assert.deepEqual(transactionQuery?.where, {
    OR: [{
      shiftId: "shift-open",
      branchId: "branch-a",
    }],
  });
});

const branchManager: AuthenticatedUser = {
  id: "manager-user",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  employeeId: "employee-a",
  branchId: "branch-a",
  isGlobalScope: false,
  roles: ["BRANCH_MANAGER"],
  permissions: ["SHIFT_VIEW_OWN"],
};

function cashTransferDetailService() {
  return new ShiftsService({
    restaurantTenant: {
      findFirst: async () => ({ id: "tenant-a" }),
    },
    branch: {
      findFirst: async () => ({ id: "branch-a" }),
    },
    cashTransfer: {
      findFirst: async () => ({
        id: "transfer-a",
        branchId: "branch-a",
        fromShift: { employeeId: "employee-b" },
      }),
    },
  } as never);
}

test("role name alone cannot read another employee's cash transfer", async () => {
  const service = cashTransferDetailService();

  await assert.rejects(
    service.getCashTransferDetail("transfer-a", branchManager),
    /Boshqa xodim smenasini ko'rish mumkin emas/,
  );
});

test("SHIFT_VIEW_BRANCH allows reading another employee's cash transfer", async () => {
  const service = cashTransferDetailService();
  const managerWithBranchRead = {
    ...branchManager,
    permissions: ["SHIFT_VIEW_OWN", "SHIFT_VIEW_BRANCH"],
  };

  const transfer = await service.getCashTransferDetail(
    "transfer-a",
    managerWithBranchRead,
  );

  assert.equal(transfer.id, "transfer-a");
});
