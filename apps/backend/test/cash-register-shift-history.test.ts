import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { CashRegisterService } from "../src/modules/cash-register/cash-register.service";

const cashier: AuthenticatedUser = {
  id: "cashier-a",
  employeeId: "employee-a",
  branchId: "branch-a",
  roles: ["CASHIER"],
  permissions: ["SHIFT_VIEW_OWN"],
};

test("cashier can read their own shift order history with requested filters", async () => {
  let orderQuery: Record<string, unknown> | null = null;
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
          orderQuery = query;
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
  assert.equal((orderQuery?.where as { shiftId: string }).shiftId, "shift-a");
  assert.equal(orderQuery?.skip, 40);
  assert.equal(orderQuery?.take, 20);
  assert.equal(
    ((orderQuery?.where as { status: string }).status),
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
  let shiftQuery: Record<string, unknown> | null = null;
  const service = new CashRegisterService(
    {
      branch: { findUnique: async () => ({ tenantId: "tenant-a" }) },
      shift: {
        findMany: async (query: Record<string, unknown>) => {
          shiftQuery = query;
          return [];
        },
      },
    } as never,
    {} as never,
  );

  await service.listOwnShifts({ limit: "25", offset: "50" }, cashier);
  assert.deepEqual(shiftQuery?.where, {
    employeeId: "employee-a",
    branch: { tenantId: "tenant-a" },
  });
  assert.equal(shiftQuery?.take, 25);
  assert.equal(shiftQuery?.skip, 50);
});

test("branch shift viewers can open a historical shift within their tenant", async () => {
  let shiftQuery: Record<string, unknown> | null = null;
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
          shiftQuery = query;
          return {
            id: "shift-old",
            employeeId: "employee-a",
            branchId: "branch-a",
            status: "CLOSED",
            shiftNumber: 12,
          };
        },
      },
    } as never,
    {} as never,
  );

  const shift = await service.getShiftHistoryDetail("shift-old", manager);
  assert.equal(shift.status, "CLOSED");
  assert.deepEqual(shiftQuery?.where, {
    id: "shift-old",
    branch: { tenantId: "tenant-a" },
  });
});
