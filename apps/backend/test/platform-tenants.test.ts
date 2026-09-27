import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { PlatformTenantsController } from "../src/modules/platform-monitoring/platform-monitoring.controller";
import { PlatformMonitoringService } from "../src/modules/platform-monitoring/platform-monitoring.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { RedisService } from "../src/redis/redis.service";

test("tenant registry is restricted to platform owners", () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, PlatformTenantsController), ["PLATFORM_OWNER"]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, PlatformTenantsController), ["SYSTEM_HEALTH_VIEW"]);
});

test("tenant inventory selects scoped activity and minimal linked monitor health", async () => {
  let query: unknown;
  const now = new Date();
  const rows = [{
    id: "tenant-1", code: "MAZETTO_FOOD", name: "Mazetto Food", status: "ACTIVE",
    createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    branches: [{ id: "branch-1", code: "CENTER", name: "Markaz", isActive: true, isTemporarilyClosed: false, acceptsOrders: true }],
    domains: [{ id: "domain-1", hostname: "mazettofood.uz", status: "VERIFIED", verifiedAt: new Date("2026-09-01T00:00:00.000Z") }],
    platformSites: [{
      id: "monitor-1", name: "Mazetto Food", productCode: "MAZETTO_FOOD", isActive: true,
      createdAt: now, lastHeartbeatAt: now, lastHeartbeatStatus: "healthy",
      websiteStatus: "ONLINE", websiteCheckedAt: now, apiStatus: "OFFLINE", apiCheckedAt: now,
      lastHeartbeatData: { totals: { openOrders: 999 } },
    }],
  }];
  const prisma = {
    restaurantTenant: { findMany: async (input: unknown) => { query = input; return rows; } },
    order: { groupBy: async () => [] },
    device: { findMany: async () => [] },
  } as unknown as PrismaService;
  const service = new PlatformMonitoringService(prisma, {} as RedisService);

  const result = await service.listTenants();
  assert.deepEqual(query, {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true, code: true, name: true, status: true, createdAt: true, updatedAt: true,
      branches: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true, isActive: true, isTemporarilyClosed: true, acceptsOrders: true },
      },
      domains: {
        orderBy: [{ hostname: "asc" }],
        select: { id: true, hostname: true, status: true, verifiedAt: true },
      },
      platformSites: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true, name: true, productCode: true, isActive: true, createdAt: true,
          lastHeartbeatAt: true, lastHeartbeatStatus: true,
          websiteStatus: true, websiteCheckedAt: true,
          apiStatus: true, apiCheckedAt: true,
        },
      },
    },
  });
  assert.equal(result[0]?.id, "tenant-1");
  assert.deepEqual(result[0]?.activity, { activeBranches: 1, acceptingOrdersBranches: 1, openOrders: 0, onlineDevices: 0, offlineDevices: 0 });
  assert.deepEqual(result[0]?.platformSites, [{
    id: "monitor-1", name: "Mazetto Food", productCode: "MAZETTO_FOOD", isActive: true,
    agentStatus: "ONLINE", lastHeartbeatAt: now.toISOString(),
    website: { status: "ONLINE", checkedAt: now.toISOString() },
    api: { status: "OFFLINE", checkedAt: now.toISOString() },
  }]);
});



test("tenant activity aggregates only branch-owned orders and devices", async () => {
  const now = new Date();
  let orderBranchIds: string[] = [];
  let deviceBranchIds: string[] = [];
  const rows = [
    { id: "tenant-a", code: "A", name: "A", status: "ACTIVE", createdAt: now, updatedAt: now, branches: [
      { id: "a-open", code: "A1", name: "A1", isActive: true, isTemporarilyClosed: false, acceptsOrders: true },
      { id: "a-paused", code: "A2", name: "A2", isActive: false, isTemporarilyClosed: true, acceptsOrders: false },
    ], domains: [] },
    { id: "tenant-b", code: "B", name: "B", status: "ACTIVE", createdAt: now, updatedAt: now, branches: [
      { id: "b-open", code: "B1", name: "B1", isActive: true, isTemporarilyClosed: true, acceptsOrders: true },
    ], domains: [] },
  ];
  const prisma = {
    restaurantTenant: { findMany: async () => rows },
    order: { groupBy: async (query: { where: { branchId: { in: string[] } } }) => {
      orderBranchIds = query.where.branchId.in;
      return [
        { branchId: "a-open", _count: { _all: 3 } },
        { branchId: "a-paused", _count: { _all: 2 } },
        { branchId: "b-open", _count: { _all: 7 } },
        { branchId: "foreign-branch", _count: { _all: 99 } },
      ];
    } },
    device: { findMany: async (query: { where: { branchId: { in: string[] } } }) => {
      deviceBranchIds = query.where.branchId.in;
      return [
        { branchId: "a-open", lastSeenAt: now },
        { branchId: "a-paused", lastSeenAt: new Date(now.getTime() - 10 * 60 * 1000) },
        { branchId: "b-open", lastSeenAt: now },
        { branchId: "foreign-branch", lastSeenAt: now },
      ];
    } },
  } as unknown as PrismaService;
  const service = new PlatformMonitoringService(prisma, {} as RedisService);

  const result = await service.listTenants();
  assert.deepEqual(orderBranchIds, ["a-open", "a-paused", "b-open"]);
  assert.deepEqual(deviceBranchIds, ["a-open", "a-paused", "b-open"]);
  assert.deepEqual(result.map((tenant) => tenant.activity), [
    { activeBranches: 1, acceptingOrdersBranches: 1, openOrders: 5, onlineDevices: 1, offlineDevices: 1 },
    { activeBranches: 1, acceptingOrdersBranches: 0, openOrders: 7, onlineDevices: 1, offlineDevices: 0 },
  ]);
});
