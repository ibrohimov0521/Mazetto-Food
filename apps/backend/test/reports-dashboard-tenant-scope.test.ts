import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { DashboardService } from "../src/modules/dashboard/dashboard.service";
import { ReportsService } from "../src/modules/reports/reports.service";
import { ReportPreset } from "../src/modules/reports/dto/report-query.dto";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

const tenantBActor: AuthenticatedUser = {
  id: "owner-b",
  tenantId: "tenant-b",
  membershipId: "membership-b",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

const activeTenant = {
  restaurantTenant: {
    findMany: async () => [{ id: "tenant-a" }],
    findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id }),
  },
};

const tenantOf = (where: Record<string, unknown>) => where.branch;

test("all restaurant report aggregations stay inside the resolved tenant", async () => {
  const filters = new Map<string, Record<string, unknown>>();
  const capture = (name: string) => async (args: { where: Record<string, unknown> }) => {
    filters.set(name, args.where);
    return [];
  };
  const service = new ReportsService({
    ...activeTenant,
    payment: {
      findMany: capture("salesPayments"),
      groupBy: capture("employeePayments"),
    },
    paymentRefund: { findMany: capture("refunds") },
    order: {
      count: async (args: { where: Record<string, unknown> }) => {
        filters.set("cancelledOrders", args.where);
        return 0;
      },
      groupBy: capture("employeeOrders"),
    },
    orderItem: {
      findMany: capture("salesItems"),
      groupBy: capture("products"),
    },
    shift: { findMany: capture("shifts") },
    employee: { findMany: capture("employees") },
    expense: {
      aggregate: async (args: { where: Record<string, unknown> }) => {
        filters.set("expenseAggregate", args.where);
        return { _sum: { amount: null }, _count: { _all: 0 } };
      },
      groupBy: capture("expenseGroups"),
      findMany: capture("expenses"),
    },
  } as never);

  const query = { preset: ReportPreset.TODAY };
  await service.getSalesReport(query, owner);
  assert.deepEqual(
    (filters.get("salesPayments")?.order as Record<string, unknown>).branch,
    { tenantId: "tenant-a" },
  );
  assert.deepEqual(tenantOf(filters.get("cancelledOrders")!), { tenantId: "tenant-a" });
  assert.deepEqual(
    ((filters.get("salesItems")?.order as Record<string, unknown>).branch),
    { tenantId: "tenant-a" },
  );
  assert.deepEqual(tenantOf(filters.get("shifts")!), { tenantId: "tenant-a" });
  assert.deepEqual(tenantOf(filters.get("refunds")!), { tenantId: "tenant-a" });

  await service.getEmployeeReport(query, owner);
  assert.deepEqual(tenantOf(filters.get("employeeOrders")!), { tenantId: "tenant-a" });
  assert.deepEqual(
    ((filters.get("employeePayments")?.order as Record<string, unknown>).branch),
    { tenantId: "tenant-a" },
  );
  assert.deepEqual(tenantOf(filters.get("shifts")!), { tenantId: "tenant-a" });
  assert.deepEqual(tenantOf(filters.get("employees")!), { tenantId: "tenant-a" });

  await service.getExpenseReport(query, owner);
  for (const key of ["expenseAggregate", "expenseGroups", "expenses"]) {
    assert.deepEqual(tenantOf(filters.get(key)!), { tenantId: "tenant-a" });
  }

  await service.getZReport(query, owner);
  assert.deepEqual(tenantOf(filters.get("expenseAggregate")!), { tenantId: "tenant-a" });

  await service.getSalesReport(query, tenantBActor);
  assert.deepEqual(
    (filters.get("salesPayments")?.order as Record<string, unknown>).branch,
    { tenantId: "tenant-b" },
  );
  assert.deepEqual(tenantOf(filters.get("cancelledOrders")!), { tenantId: "tenant-b" });
  assert.deepEqual(
    ((filters.get("salesItems")?.order as Record<string, unknown>).branch),
    { tenantId: "tenant-b" },
  );
  assert.deepEqual(tenantOf(filters.get("shifts")!), { tenantId: "tenant-b" });
  assert.deepEqual(tenantOf(filters.get("refunds")!), { tenantId: "tenant-b" });
});

test("dashboard summary aggregates only the resolved tenant", async () => {
  const filters = new Map<string, Record<string, unknown>>();
  const service = new DashboardService({
    ...activeTenant,
    payment: {
      aggregate: async (args: { where: Record<string, unknown> }) => {
        filters.set("payments", args.where);
        return { _sum: { amount: null } };
      },
    },
    order: {
      count: async (args: { where: Record<string, unknown> }) => {
        filters.set("orders", args.where);
        return 0;
      },
    },
    shift: {
      count: async (args: { where: Record<string, unknown> }) => {
        filters.set("shifts", args.where);
        return 0;
      },
    },
  } as never);

  await service.getSummary(owner);
  assert.deepEqual(
    ((filters.get("payments")?.order as Record<string, unknown>).branch),
    { tenantId: "tenant-a" },
  );
  assert.deepEqual(tenantOf(filters.get("orders")!), { tenantId: "tenant-a" });
  assert.deepEqual(tenantOf(filters.get("shifts")!), { tenantId: "tenant-a" });

  await service.getSummary(tenantBActor);
  assert.deepEqual(
    ((filters.get("payments")?.order as Record<string, unknown>).branch),
    { tenantId: "tenant-b" },
  );
  assert.deepEqual(tenantOf(filters.get("orders")!), { tenantId: "tenant-b" });
  assert.deepEqual(tenantOf(filters.get("shifts")!), { tenantId: "tenant-b" });
});
