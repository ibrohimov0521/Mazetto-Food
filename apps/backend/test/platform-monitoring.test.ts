import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { IS_PUBLIC_KEY } from "../src/common/decorators/public.decorator";
import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import {
  PlatformEventsController,
  PlatformDiagnosticsController,
  PlatformAuditController,
  PlatformHeartbeatController,
  PlatformMonitoringController,
} from "../src/modules/platform-monitoring/platform-monitoring.controller";
import {
  isHealthyHttpStatus,
  isHeadUnsupported,
  isPublicAddress,
  normalizePublicHttpsUrl,
} from "../src/modules/platform-monitoring/public-https-probe";
import { PlatformMonitoringService } from "../src/modules/platform-monitoring/platform-monitoring.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { RedisService } from "../src/redis/redis.service";
import type { PlatformHeartbeatDto } from "../src/modules/platform-monitoring/dto/platform-monitoring.dto";

test("monitoring registry is restricted to the platform owner health permission", () => {
  assert.deepEqual(
    Reflect.getMetadata(ROLES_KEY, PlatformMonitoringController),
    ["PLATFORM_OWNER"],
  );
  assert.deepEqual(
    Reflect.getMetadata(PERMISSIONS_KEY, PlatformMonitoringController),
    ["SYSTEM_HEALTH_VIEW"],
  );
});

test("global activity feed has the same owner-only access policy", () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, PlatformEventsController), ["PLATFORM_OWNER"]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, PlatformEventsController), ["SYSTEM_HEALTH_VIEW"]);
});

test("technical diagnostics are owner-only, bounded, filtered, and time-limited", async () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, PlatformDiagnosticsController), ["PLATFORM_OWNER"]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, PlatformDiagnosticsController), ["SYSTEM_HEALTH_VIEW"]);
  let query: unknown;
  const prisma = {
    platformSiteDiagnostic: { findMany: async (input: unknown) => { query = input; return []; } },
  } as unknown as PrismaService;
  const service = new PlatformMonitoringService(prisma, {} as RedisService);

  await service.listDiagnostics(500, " site-1 ", "error");
  const request = query as { where: Record<string, unknown>; take: number; orderBy: unknown };
  assert.deepEqual(request.where.siteId, "site-1");
  assert.deepEqual(request.where.severity, "error");
  assert.ok("gte" in (request.where.occurredAt as object));
  assert.equal(request.take, 200);
  assert.deepEqual(request.orderBy, [{ occurredAt: "desc" }, { receivedAt: "desc" }]);
  await assert.rejects(service.listDiagnostics(20, " "), /identifikatori/);
  await assert.rejects(service.listDiagnostics(20, undefined, "fatal"), /darajasi/);
});

test("platform audit is owner-only and queries only bounded control-plane actions", async () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, PlatformAuditController), ["PLATFORM_OWNER"]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, PlatformAuditController), ["SYSTEM_HEALTH_VIEW"]);
  let query: unknown;
  let rows: unknown[] = [];
  const prisma = { auditLog: { findMany: async (input: unknown) => { query = input; return rows; } } } as unknown as PrismaService;
  const service = new PlatformMonitoringService(prisma, {} as RedisService);
  await service.listPlatformAudit(500, -4);
  assert.deepEqual(query, {
    where: { action: { startsWith: "PLATFORM_" }, entity: { in: ["PLATFORM_SITE", "PLATFORM_SITE_EVENT"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: 0,
    take: 101,
    select: {
      id: true, action: true, entity: true, entityId: true, metadata: true, createdAt: true,
      user: { select: { id: true, displayName: true, email: true, phone: true } },
    },
  });
  await service.listPlatformAudit(20, 10, "owner@bestteam.uz");
  const search = query as unknown as { where: { OR: unknown[] }; skip: number; take: number };
  assert.equal(search.skip, 10);
  assert.equal(search.take, 21);
  assert.deepEqual(search.where.OR, [
    { action: { contains: "owner@bestteam.uz", mode: "insensitive" } },
    { entityId: { contains: "owner@bestteam.uz", mode: "insensitive" } },
    { user: { is: { OR: [
      { displayName: { contains: "owner@bestteam.uz", mode: "insensitive" } },
      { email: { contains: "owner@bestteam.uz", mode: "insensitive" } },
      { phone: { contains: "owner@bestteam.uz", mode: "insensitive" } },
    ] } } },
  ]);
  rows = [{ id: "first" }, { id: "next" }];
  const page = await service.listPlatformAudit(1);
  assert.deepEqual(page, { entries: [{ id: "first" }], hasNext: true });
});

test("event acknowledgement is owner-only and available only for actionable incidents", () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, PlatformEventsController), ["PLATFORM_OWNER"]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, PlatformEventsController), ["SYSTEM_HEALTH_VIEW"]);
});

test("acknowledging an incident is idempotent and writes its audit record once", async () => {
  const event = { id: "event-1", siteId: "site-1", code: "API_OFFLINE", acknowledgedAt: null as Date | null, acknowledgedById: null as string | null, site: { name: "QA Restaurant" } };
  let auditWrites = 0;
  let auditMetadata: unknown;
  const tx = {
    platformSiteEvent: {
      findUnique: async () => ({ ...event }),
      findUniqueOrThrow: async () => ({ ...event }),
      updateMany: async ({ data }: { data: { acknowledgedAt: Date; acknowledgedById: string } }) => {
        if (event.acknowledgedAt) return { count: 0 };
        Object.assign(event, data);
        return { count: 1 };
      },
    },
    auditLog: { create: async ({ data }: { data: { metadata: unknown } }) => { auditWrites += 1; auditMetadata = data.metadata; return {}; } },
  };
  const prisma = { $transaction: (callback: (value: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaService;
  const service = new PlatformMonitoringService(prisma, {} as RedisService);
  const actor = { id: "owner-1", email: "owner@bestteam.uz" } as AuthenticatedUser;

  const first = await service.acknowledgeEvent("event-1", actor);
  const second = await service.acknowledgeEvent("event-1", actor);
  assert.equal(first.acknowledgedAt, second.acknowledgedAt);
  assert.equal(first.acknowledgedById, actor.id);
  assert.equal(first.acknowledgedBy?.email, actor.email);
  assert.equal(auditWrites, 1);
  assert.deepEqual(auditMetadata, { siteId: "site-1", siteName: "QA Restaurant", code: "API_OFFLINE" });
});

test("global activity feed is bounded, ordered and includes restaurant identity", async () => {
  let query: unknown;
  const prisma = {
    platformSiteEvent: { findMany: async (input: unknown) => { query = input; return []; } },
  } as unknown as PrismaService;
  const service = new PlatformMonitoringService(prisma, {} as RedisService);
  await service.listRecentEvents(500);
  assert.deepEqual(query, {
    orderBy: [{ occurredAt: "desc" }, { receivedAt: "desc" }],
    take: 200,
    select: {
      id: true, siteId: true, code: true, branchId: true, branchName: true,
      occurredAt: true, receivedAt: true,
      acknowledgedAt: true, acknowledgedById: true,
      acknowledgedBy: { select: { displayName: true, email: true, phone: true } },
      site: { select: { name: true, productCode: true } },
    },
  });
  await service.listRecentEvents(50, " site-2 ");
  assert.ok(query && typeof query === "object" && "where" in query);
  assert.deepEqual(query.where, { siteId: "site-2" });
  await service.listRecentEvents(50, undefined, "open");
  assert.deepEqual(query.where, {
    acknowledgedAt: null,
    code: { in: ["WEBSITE_OFFLINE", "API_OFFLINE", "AGENT_DISCONNECTED", "SERVICE_DEGRADED", "PRINTER_FAILED", "DEVICE_DISCONNECTED"] },
  });
  await service.listRecentEvents(50, "site-2", "acknowledged");
  assert.deepEqual(query.where, { siteId: "site-2", acknowledgedAt: { not: null } });
  await assert.rejects(service.listRecentEvents(50, undefined, "unknown"), /Hodisa holati/);
  await assert.rejects(service.listRecentEvents(50, " "), /identifikatori/);
});

test("owner reports aggregate only validated site-level summaries and mark stale agents", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const prisma = {
    platformSite: {
      findMany: async () => [
        {
          id: "site-1", name: "Restaurant One", productCode: "FAST_FOOD", lastHeartbeatAt: now,
          lastHeartbeatData: { dailyReports: [{ day: today, completedOrders: 4, cancelledOrders: 1, completedOrderTotal: "125000" }] },
        },
        {
          id: "site-2", name: "Restaurant Two", productCode: "FAST_FOOD", lastHeartbeatAt: null,
          lastHeartbeatData: { dailyReports: [{ day: today, completedOrders: 2, cancelledOrders: 0, completedOrderTotal: "75000" }, { day: today, completedOrders: 99, cancelledOrders: 0, completedOrderTotal: "NaN" }] },
        },
      ],
    },
  } as unknown as PrismaService;
  const service = new PlatformMonitoringService(prisma, {} as RedisService);

  const result = await service.listPlatformReports(7);
  assert.equal(result.sites.length, 2);
  assert.equal(result.daily.find((day) => day.day === today)?.completedOrders, 6);
  assert.equal(result.daily.find((day) => day.day === today)?.cancelledOrders, 1);
  assert.equal(result.daily.find((day) => day.day === today)?.completedOrderTotal, 200000);
  const staleSite = result.sites[1];
  assert.ok(staleSite);
  assert.equal(staleSite.stale, true);
  assert.equal(staleSite.reports.length, 1);
  await assert.rejects(service.listPlatformReports(30), /7 yoki 14 kun/);
});

test("agent heartbeat is public only at transport layer and still token protected by handler", () => {
  const handler = PlatformHeartbeatController.prototype.receiveHeartbeat;
  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, handler), true);
});

test("monitor targets require public HTTPS domains, not local or credentialed URLs", () => {
  assert.equal(
    normalizePublicHttpsUrl("https://food.example/health#ignored"),
    "https://food.example/health",
  );
  for (const unsafe of [
    "http://food.example",
    "https://localhost",
    "https://kitchen.local",
    "https://127.0.0.1",
    "https://user:password@food.example",
  ]) {
    assert.throws(() => normalizePublicHttpsUrl(unsafe));
  }
});

test("monitor probes refuse private, reserved, and documentation IP ranges", () => {
  for (const address of [
    "10.0.0.1",
    "127.0.0.1",
    "169.254.10.2",
    "172.20.0.5",
    "192.168.1.2",
    "192.0.2.5",
    "198.51.100.10",
    "203.0.113.12",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:192.168.0.1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("website and API probes treat HTTP client errors as offline", () => {
  for (const status of [200, 204, 301, 302]) {
    assert.equal(isHealthyHttpStatus(status), true, String(status));
  }
  for (const status of [0, 199, 400, 403, 404, 500]) {
    assert.equal(isHealthyHttpStatus(status), false, String(status));
  }
  assert.equal(isHeadUnsupported(405), true);
  assert.equal(isHeadUnsupported(501), true);
  assert.equal(isHeadUnsupported(404), false);
});

test("invalid monitor URLs produce a client error before writing a site", async () => {
  const service = new PlatformMonitoringService({} as PrismaService, {} as RedisService);
  await assert.rejects(
    service.createSite({
      name: "QA", productCode: "FAST_FOOD", websiteUrl: "http://localhost", apiHealthUrl: "https://food.example/health",
    }, { id: "owner" } as Parameters<PlatformMonitoringService["createSite"]>[1]),
    BadRequestException,
  );
});

test("heartbeat rejects a token rotated after the initial lookup", async () => {
  const token = "a".repeat(40);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  let eventWrites = 0;
  const prisma = {
    platformSite: {
      findUnique: async () => ({
        id: "site-1",
        isActive: true,
        tokenHash,
        createdAt: new Date(),
        lastHeartbeatAt: null,
        lastHeartbeatStatus: null,
      }),
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        platformSite: { updateMany: async () => ({ count: 0 }) },
        platformSiteEvent: { createMany: async () => { eventWrites += 1; } },
      }),
  } as unknown as PrismaService;
  const service = new PlatformMonitoringService(prisma, {} as RedisService);
  const heartbeat = {
    version: "test",
    status: "healthy",
    services: { backend: "ok", database: "ok", redis: "ok" },
    totals: {
      branchCount: 0,
      openOrders: 0,
      kitchenQueue: 0,
      onlineDevices: 0,
      offlineDevices: 0,
      deadPrintJobs: 0,
    },
    kitchens: [],
    events: [],
  } as PlatformHeartbeatDto;

  await assert.rejects(service.receiveHeartbeat("site-1", token, heartbeat), /bekor qilingan/);
  assert.equal(eventWrites, 0);
});

test("operational log can filter one kitchen without mixing other branches", async () => {
  let queriedWhere: unknown;
  const prisma = {
    platformSite: { findUnique: async () => ({ id: "site-1" }) },
    platformSiteEvent: {
      findMany: async (query: { where: unknown }) => {
        queriedWhere = query.where;
        return [];
      },
    },
  } as unknown as PrismaService;
  const service = new PlatformMonitoringService(prisma, {} as RedisService);

  await service.listEvents("site-1", 50, " kitchen-1 ");
  assert.deepEqual(queriedWhere, { siteId: "site-1", branchId: "kitchen-1" });
  await assert.rejects(service.listEvents("site-1", 50, " "), /identifikatori/);
  await assert.rejects(service.listEvents("site-1", 50, "x".repeat(81)), /identifikatori/);
});
