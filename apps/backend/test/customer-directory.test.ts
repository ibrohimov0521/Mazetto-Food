import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { CustomersService } from "../src/modules/customers/customers.service";
import type { ListCustomerDirectoryDto } from "../src/modules/customers/dto/list-customers.dto";

const owner: AuthenticatedUser = {
  id: "owner-a",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

test("customer directory returns one tenant profile with both channel badges", async () => {
  const seen: { list?: unknown; count?: unknown } = {};
  const now = new Date("2026-11-26T10:00:00.000Z");
  const prisma = {
    restaurantTenant: {
      findFirst: async () => ({ id: "tenant-a" }),
    },
    customer: {
      findMany: async (args: unknown) => {
        seen.list = args;
        return [
          {
            id: "customer-a",
            name: "Aziza",
            phone: "+998901234567",
            email: null,
            telegramUserId: "telegram-secret-id",
            telegramLinkedAt: now,
            webLastSeenAt: now,
            bonusBalance: "0.00",
            createdAt: now,
            _count: { customerOrders: 2, favorites: 1 },
          },
        ];
      },
      count: async (args: unknown) => {
        seen.count = args;
        return 1;
      },
    },
  };
  const service = Object.assign(Object.create(CustomersService.prototype), {
    prisma,
  }) as CustomersService;

  const result = await service.listCustomers(
    {
      limit: 50,
      offset: 0,
      search: "Aziza",
      channel: "BOTH",
    } as ListCustomerDirectoryDto,
    owner,
  );
  const [customer] = result.items;

  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.ok(customer);
  assert.deepEqual(customer.channels, ["WEB", "TELEGRAM"]);
  assert.equal("telegramUserId" in customer, false);
  assert.deepEqual(seen.list, {
    where: {
      tenantId: "tenant-a",
      webLastSeenAt: { not: null },
      telegramUserId: { not: null },
      OR: [
        { name: { contains: "Aziza", mode: "insensitive" } },
        { email: { contains: "Aziza", mode: "insensitive" } },
        { phone: { contains: "Aziza" } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: 0,
    take: 50,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      telegramUserId: true,
      telegramLinkedAt: true,
      webLastSeenAt: true,
      bonusBalance: true,
      createdAt: true,
      _count: { select: { customerOrders: true, favorites: true } },
    },
  });
  assert.deepEqual(seen.count, {
    where: (seen.list as { where: unknown }).where,
  });
  assert.equal(
    "passwordHash" in (seen.list as { select: Record<string, unknown> }).select,
    false,
  );
});

test("customer channel totals count canonical profiles, including the overlap", async () => {
  const filters: unknown[] = [];
  const counts = [5, 4, 3, 2];
  const prisma = {
    restaurantTenant: {
      findFirst: async () => ({ id: "tenant-a" }),
    },
    customer: {
      count: async (args: unknown) => {
        filters.push(args);
        return counts[filters.length - 1];
      },
      aggregate: async () => ({ _sum: { bonusBalance: null } }),
    },
    customerOrder: { count: async () => 7 },
  };
  const service = Object.assign(Object.create(CustomersService.prototype), {
    prisma,
  }) as CustomersService;

  const result = await service.getCustomerStats(owner);

  assert.equal(result.customers, 5);
  assert.equal(result.webCustomers, 4);
  assert.equal(result.telegramCustomers, 3);
  assert.equal(result.multiChannelCustomers, 2);
  assert.equal(result.onlineOrders, 7);
  assert.deepEqual(filters, [
    { where: { tenantId: "tenant-a" } },
    { where: { tenantId: "tenant-a", webLastSeenAt: { not: null } } },
    { where: { tenantId: "tenant-a", telegramUserId: { not: null } } },
    {
      where: {
        tenantId: "tenant-a",
        webLastSeenAt: { not: null },
        telegramUserId: { not: null },
      },
    },
  ]);
});
