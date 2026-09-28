import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { CustomerCourierService } from "../src/modules/customers/customer-courier.service";
import { CustomersService } from "../src/modules/customers/customers.service";
import { ListCustomersDto, ListOnlineOrdersDto } from "../src/modules/customers/dto/list-customers.dto";
import type { PrismaService } from "../src/prisma/prisma.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

function database(extra: Record<string, unknown> = {}) {
  return {
    restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
    branch: { findFirst: async () => null },
    ...extra,
  };
}

test("customer administration reads and statistics stay in the actor tenant", async () => {
  const where: Record<string, unknown> = {};
  const prisma = database({
    customer: {
      findMany: async (args: { where: unknown }) => { where.list = args.where; return []; },
      count: async (args: { where: unknown }) => { where.count = args.where; return 0; },
      aggregate: async (args: { where: unknown }) => { where.aggregate = args.where; return { _sum: { bonusBalance: null } }; },
    },
    customerOrder: {
      findMany: async (args: { where: unknown }) => { where.orders = args.where; return []; },
      count: async (args: { where: unknown }) => { where.onlineOrders = args.where; return 0; },
    },
  });
  const service = Object.assign(Object.create(CustomersService.prototype), { prisma }) as CustomersService;

  await service.listCustomers(new ListCustomersDto(), owner);
  await service.listOnlineOrders(new ListOnlineOrdersDto(), owner);
  await service.getCustomerStats(owner);

  assert.deepEqual(where.list, { tenantId: "tenant-a" });
  assert.deepEqual(where.orders, { branch: { tenantId: "tenant-a" } });
  assert.deepEqual(where.count, { tenantId: "tenant-a" });
  assert.deepEqual(where.aggregate, { tenantId: "tenant-a" });
  assert.deepEqual(where.onlineOrders, { branch: { tenantId: "tenant-a" } });
});

test("bulk customer deletion refuses a customer from another tenant", async () => {
  let lookup: unknown;
  let deletion: unknown;
  const prisma = database({
    customer: {
      findMany: async (args: { where: unknown }) => { lookup = args.where; return []; },
      deleteMany: async (args: { where: unknown }) => { deletion = args.where; return { count: 1 }; },
    },
  });
  const service = Object.assign(Object.create(CustomersService.prototype), { prisma }) as CustomersService;

  await assert.rejects(service.deleteCustomersBulk(["customer-b"], owner), /not found|filial doirasida emas/i);
  assert.deepEqual(lookup, { id: { in: ["customer-b"] }, tenantId: "tenant-a" });
  assert.equal(deletion, undefined);
});

test("courier dashboards scope delivery and courier rows to the tenant", async () => {
  const where: Record<string, unknown> = {};
  const prisma = database({
    customerOrder: { findMany: async (args: { where: unknown }) => { where.deliveries = args.where; return []; } },
    employee: { findMany: async (args: { where: unknown }) => { where.couriers = args.where; return []; } },
  });
  const service = new CustomerCourierService(prisma as PrismaService, {} as never, {} as never);

  await service.listActiveDeliveries(owner);
  await service.listCouriers(owner);

  assert.deepEqual(where.deliveries, {
    type: "DELIVERY",
    branch: { tenantId: "tenant-a" },
    order: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
  });
  assert.deepEqual(where.couriers, {
    status: "ACTIVE",
    branch: { tenantId: "tenant-a" },
    user: { roles: { some: { role: { code: "COURIER" } } } },
  });
});

test("courier mutations scope database lock and lookup by tenant", async () => {
  const actor = { ...owner, employeeId: "employee-a" };
  const reads: unknown[] = [];
  const locks: string[] = [];
  const txClient = {
    $queryRaw: async (strings: TemplateStringsArray) => { locks.push(Array.from(strings).join("?")); return []; },
    customerOrder: { findFirst: async (args: { where: unknown }) => { reads.push(args.where); return null; } },
  };
  const prisma = database({
    $transaction: async (callback: (transaction: typeof txClient) => Promise<unknown>) => callback(txClient),
  });
  const service = new CustomerCourierService(prisma as PrismaService, {} as never, {} as never);

  await assert.rejects(service.assignCourier("customer-b", null, actor), /not found/i);
  await assert.rejects(
    service.updateCourierOrderStatus("customer-b", { status: "SERVED" } as never, actor),
    /not found/i,
  );

  assert.deepEqual(reads, [
    { id: "customer-b", branch: { tenantId: "tenant-a" } },
    { id: "customer-b", branch: { tenantId: "tenant-a" } },
  ]);
  assert.equal(locks.length, 2);
  assert.ok(locks.every((sql) => sql.includes('b."tenantId" = ?')));
});
