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
  assert.equal((captured.orderQuery?.where as { shiftId: string }).shiftId, "shift-a");
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
          return [];
        },
      },
    } as never,
    {} as never,
  );

  await service.listOwnShifts({ limit: "25", offset: "50" }, cashier);
  assert.deepEqual(captured.shiftQuery?.where, {
    employeeId: "employee-a",
    branch: { tenantId: "tenant-a" },
  });
  assert.equal(captured.shiftQuery?.take, 25);
  assert.equal(captured.shiftQuery?.skip, 50);
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
          };
        },
      },
    } as never,
    {} as never,
  );

  const shift = await service.getShiftHistoryDetail("shift-old", manager);
  assert.equal(shift.status, "CLOSED");
  assert.deepEqual(captured.shiftQuery?.where, {
    id: "shift-old",
    branch: { tenantId: "tenant-a" },
  });
});
