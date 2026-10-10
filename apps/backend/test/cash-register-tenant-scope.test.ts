import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { CashRegisterService } from "../src/modules/cash-register/cash-register.service";

const cashier: AuthenticatedUser = {
  id: "cashier-a",
  employeeId: "employee-a",
  branchId: "branch-a",
  roles: ["CASHIER"],
  permissions: ["CASH_VIEW"],
};

test("cashier shift and transaction reads are tenant-scoped", async () => {
  const filters: unknown[] = [];
  const shift = {
    findFirst: async (args: { where: unknown }) => {
      filters.push(args.where);
      return null;
    },
  };
  const service = new CashRegisterService(
    {
      branch: {
        findUnique: async () => ({ tenantId: "tenant-a" }),
      },
      shift,
      $transaction: async (operation: (tx: { shift: typeof shift }) => Promise<unknown>) =>
        operation({ shift }),
    } as never,
    {} as never,
  );

  assert.equal(await service.getCurrentShift(cashier), null);
  assert.deepEqual(
    await service.getTransactions("shift-b", {}, cashier),
    { items: [], total: 0 },
  );
  assert.deepEqual(filters, [
    {
      employeeId: "employee-a",
      status: "OPEN",
      branch: { tenantId: "tenant-a" },
    },
    {
      id: "shift-b",
      branch: { tenantId: "tenant-a" },
    },
  ]);
});
