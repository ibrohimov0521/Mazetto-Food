import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { CustomersService } from "../src/modules/customers/customers.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

test("Telegram statistics are tenant and branch scoped and use linked customers", async () => {
  const seen: Record<string, unknown> = {};
  const prisma = {
    restaurantTenant: {
      findFirst: async (args: unknown) => {
        seen.tenant = args;
        return { id: "tenant-a" };
      },
    },
    branch: {
      findFirst: async (args: unknown) => {
        seen.branch = args;
        return { id: "branch-a" };
      },
    },
    customer: {
      count: async (args: unknown) => {
        seen.customers = args;
        return 8;
      },
    },
    payment: {
      aggregate: async (args: unknown) => {
        seen.revenue = args;
        return { _sum: { amount: { toString: () => "42000.00" } } };
      },
    },
    order: {
      count: async (args: unknown) => {
        const where = (args as { where: { createdAt?: unknown } }).where;
        if (where.createdAt) {
          seen.recentOrders = args;
          return 5;
        }
        seen.allOrders = args;
        return 23;
      },
      groupBy: async (args: unknown) => {
        seen.statuses = args;
        return [
          { status: "COMPLETED", _count: { _all: 3 } },
          { status: "CANCELLED", _count: { _all: 2 } },
        ];
      },
    },
  };
  const service = Object.assign(Object.create(CustomersService.prototype), {
    prisma,
  }) as CustomersService;
  const branchManager: AuthenticatedUser = {
    ...owner,
    roles: ["BRANCH_MANAGER"],
    isGlobalScope: false,
    branchId: "branch-a",
  };

  const result = await service.getTelegramStats(branchManager);

  assert.deepEqual(seen.customers, {
    where: {
      tenantId: "tenant-a",
      telegramUserId: { not: null },
      telegramChatId: { not: null },
      customerOrders: { some: { branchId: "branch-a" } },
    },
  });
  assert.deepEqual(seen.allOrders, {
    where: { tenantId: "tenant-a", source: "TELEGRAM", branchId: "branch-a" },
  });
  assert.deepEqual(seen.revenue, {
    where: {
      status: { in: ["PAID", "SUCCESS", "PARTIALLY_REFUNDED"] },
      paidAt: {
        gte: (seen.recentOrders as { where: { createdAt: { gte: Date } } })
          .where.createdAt.gte,
      },
      order: {
        tenantId: "tenant-a",
        source: "TELEGRAM",
        branchId: "branch-a",
        status: {
          in: ["CONFIRMED", "PREPARING", "READY", "SERVED", "COMPLETED"],
        },
      },
    },
    _sum: { amount: true },
  });
  assert.equal(result.linkedCustomers, 8);
  assert.equal(result.totalBotUsers, null);
  assert.equal(result.botUsers, null);
  assert.equal(result.activeBotUsers30Days, null);
  assert.equal(result.blockedBotUsers, null);
  assert.equal(result.telegramOrders, 23);
  assert.equal(result.recentOrders, 5);
  assert.equal(result.recentPaidAmount, "42000.00");
  assert.deepEqual(result.recentStatuses, [
    { status: "COMPLETED", count: 3 },
    { status: "CANCELLED", count: 2 },
  ]);
});


test("global Telegram statistics count active, recent, and blocked bot users", async () => {
  const calls: unknown[] = [];
  const prisma = {
    restaurantTenant: {
      findFirst: async () => ({ id: "tenant-a" }),
    },
    customer: { count: async () => 4 },
    order: {
      count: async ({ where }: { where: { createdAt?: unknown } }) =>
        where.createdAt ? 2 : 6,
      groupBy: async () => [],
    },
    payment: { aggregate: async () => ({ _sum: { amount: null } }) },
    telegramBotUser: {
      count: async (args: unknown) => {
        calls.push(args);
        return [18, 12, 5, 3, 10][calls.length - 1];
      },
    },
  };
  const service = Object.assign(Object.create(CustomersService.prototype), {
    prisma,
  }) as CustomersService;

  const result = await service.getTelegramStats(owner);

  assert.equal(result.totalBotUsers, 18);
  assert.equal(result.botUsers, 12);
  assert.equal(result.activeBotUsers30Days, 5);
  assert.equal(result.blockedBotUsers, 3);
  assert.equal(result.unknownBotUserStatus, 10);
  assert.deepEqual(calls[0], { where: { tenantId: "tenant-a" } });
  assert.deepEqual(calls[1], {
    where: { tenantId: "tenant-a", isBlocked: false },
  });
  const activeQuery = calls[2] as {
    where: { tenantId: string; isBlocked: boolean; lastSeenAt: { gte: Date } };
  };
  assert.equal(activeQuery.where.tenantId, "tenant-a");
  assert.equal(activeQuery.where.isBlocked, false);
  assert.ok(activeQuery.where.lastSeenAt.gte instanceof Date);
  assert.deepEqual(calls[3], {
    where: { tenantId: "tenant-a", isBlocked: true },
  });
  assert.deepEqual(calls[4], {
    where: { tenantId: "tenant-a", isBlocked: null },
  });
});
