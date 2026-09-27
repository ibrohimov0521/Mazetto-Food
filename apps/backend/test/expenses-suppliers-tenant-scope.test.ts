import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ExpensesService } from "../src/modules/expenses/expenses.service";
import { SuppliersService } from "../src/modules/suppliers/suppliers.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

test("expense and category listings filter through tenant-owned branches", async () => {
  const filters: Record<string, unknown>[] = [];
  const service = new ExpensesService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    expense: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.push(args.where);
        return [];
      },
    },
    expenseCategory: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.push(args.where);
        return [];
      },
    },
  } as never);

  await service.listExpenses({ offset: 0, limit: 20 }, owner);
  await service.listCategoryRecords(owner);
  assert.deepEqual(filters[0]?.branch, { tenantId: "tenant-a" });
  assert.deepEqual(filters[1]?.branch, { tenantId: "tenant-a" });
});

test("shared suppliers are visible only while exactly one tenant is active", async () => {
  let query: Record<string, unknown> | undefined;
  const service = new SuppliersService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    supplier: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        query = args.where;
        return [];
      },
    },
  } as never);

  await service.listSuppliers(undefined, owner);
  assert.deepEqual(query?.OR, [
    { branch: { tenantId: "tenant-a" } },
    { branchId: null },
  ]);

  let supplierReads = 0;
  const ambiguous = new SuppliersService({
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
    },
    supplier: {
      findMany: async () => {
        supplierReads += 1;
        return [];
      },
    },
  } as never);
  await assert.rejects(ambiguous.listSuppliers(undefined, owner));
  assert.equal(supplierReads, 0);
});
