import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "../src/common/auth/permissions";
import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { TenantRequestContextService } from "../src/common/tenant/tenant-request-context.service";
import { PlatformTenantLifecycleController } from "../src/modules/platform-monitoring/platform-tenant-lifecycle.controller";
import { PlatformTenantLifecycleService } from "../src/modules/platform-monitoring/platform-tenant-lifecycle.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const baseRecords = {
  branches: 2,
  domains: 2,
  verifiedDomains: 1,
  memberships: 4,
  customers: 11,
  orders: 1,
  payments: 1,
  openOrders: 0,
  openShifts: 0,
  pendingCashTransfers: 0,
  platformSites: 1,
  activeOwners: 1,
};

function lifecycleFixture(options: {
  code?: string;
  status?: string;
  domains?: string[];
  openOrders?: number;
  openShifts?: number;
  pendingCashTransfers?: number;
  archiveMetadata?: unknown;
  transactionConflict?: boolean;
  branches?: number;
  verifiedDomains?: number;
  activeOwners?: number;
} = {}) {
  const tenant = {
    id: "tenant-1",
    code: options.code ?? "NORTH_CAFE",
    name: "North Cafe",
    status: options.status ?? "ACTIVE",
    domains: (options.domains ?? ["north.example.uz"]).map((hostname) => ({ hostname })),
  };
  const records = {
    ...baseRecords,
    openOrders: options.openOrders ?? 0,
    openShifts: options.openShifts ?? 0,
    pendingCashTransfers: options.pendingCashTransfers ?? 0,
    branches: options.branches ?? baseRecords.branches,
    verifiedDomains: options.verifiedDomains ?? baseRecords.verifiedDomains,
    activeOwners: options.activeOwners ?? baseRecords.activeOwners,
  };
  const auditRows: Array<Record<string, unknown>> = [];
  let openOrderStatuses: string[] = [];
  let transactionOptions: unknown;
  const updates: Array<{ where: unknown; data: unknown }> = [];
  let deleteCalls = 0;
  const archiveMetadata = options.archiveMetadata === undefined
    ? null
    : { metadata: options.archiveMetadata };

  const tx = {
    restaurantTenant: {
      findUnique: async () => tenant,
      updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
        updates.push({ where, data });
        if (tenant.status !== where.status) return { count: 0 };
        tenant.status = data.status;
        return { count: 1 };
      },
      delete: async () => { deleteCalls += 1; },
      deleteMany: async () => { deleteCalls += 1; },
    },
    branch: { count: async () => records.branches },
    tenantDomain: { count: async ({ where }: { where: { status?: string } }) =>
      where.status === "VERIFIED" ? records.verifiedDomains : records.domains },
    tenantMembership: { count: async ({ where }: { where?: { roles?: unknown } } = {}) =>
      where?.roles ? records.activeOwners : records.memberships },
    tenantFeature: { findUnique: async () => ({ isEnabled: false }) },
    tenantTelegramConfiguration: { findUnique: async () => null },
    customer: { count: async () => records.customers },
    order: {
      count: async ({ where }: { where: { status?: { in?: string[] } } }) => {
        if (where.status?.in) openOrderStatuses = where.status.in;
        return where.status ? records.openOrders : records.orders;
      },
    },
    payment: { count: async () => records.payments },
    shift: { count: async () => records.openShifts },
    cashTransfer: { count: async () => records.pendingCashTransfers },
    platformSite: { count: async () => records.platformSites },
    auditLog: {
      findFirst: async () => archiveMetadata,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        auditRows.push(data);
        return { id: `audit-${auditRows.length}` };
      },
    },
  };
  const lifecycleOptions = options;
  const prisma = {
    restaurantTenant: tx.restaurantTenant,
    branch: tx.branch,
    tenantDomain: tx.tenantDomain,
    tenantMembership: tx.tenantMembership,
    tenantFeature: tx.tenantFeature,
    tenantTelegramConfiguration: tx.tenantTelegramConfiguration,
    $transaction: async (
      callback: (value: unknown) => Promise<unknown>,
      options?: unknown,
    ) => {
      transactionOptions = options;
      if (options && lifecycleOptions.transactionConflict) {
        throw new Prisma.PrismaClientKnownRequestError("transaction serialization conflict", {
          code: "P2034",
          clientVersion: "test",
        });
      }
      return callback(tx);
    },
  } as unknown as PrismaService;
  return { prisma, tenant, records, auditRows, updates, get openOrderStatuses() { return openOrderStatuses; }, get transactionOptions() { return transactionOptions; }, get deleteCalls() { return deleteCalls; } };
}

const confirmation = {
  confirmationCode: "NORTH_CAFE",
  reason: "Restaurant owner requested closure",
};

async function withPlatformActivationFlag<T>(enabled: boolean, callback: () => Promise<T>): Promise<T> {
  const previous = process.env.PLATFORM_TENANT_ACTIVATION_ENABLED;
  process.env.PLATFORM_TENANT_ACTIVATION_ENABLED = enabled ? "true" : "false";
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete process.env.PLATFORM_TENANT_ACTIVATION_ENABLED;
    else process.env.PLATFORM_TENANT_ACTIVATION_ENABLED = previous;
  }
}

test("tenant lifecycle routes remain restricted to platform owners", () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, PlatformTenantLifecycleController), ["PLATFORM_OWNER"]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, PlatformTenantLifecycleController), [PERMISSIONS.SYSTEM_HEALTH_VIEW]);
});

test("activation preview lists all prerequisites and stays read-only", async () => {
  await withPlatformActivationFlag(false, async () => {
    const fixture = lifecycleFixture({ status: "PROVISIONING", branches: 0, verifiedDomains: 0, activeOwners: 0 });
    const service = new PlatformTenantLifecycleService(fixture.prisma);
    const preview = await service.activationPreview("tenant-1");

    assert.equal(preview.canActivate, false);
    assert.deepEqual(preview.readiness, { branches: 0, verifiedDomains: 0, activeOwners: 0, telegramReady: true, platformActivationEnabled: false });
    assert.equal(preview.blockers.length, 4);
    assert.match(preview.blockers.join(" "), /domenning sayt\/POS marshruti/);
    assert.equal(fixture.tenant.status, "PROVISIONING");
    assert.equal(fixture.auditRows.length, 0);
  });
});

test("activation transaction refuses while the platform security gate is closed", async () => {
  await withPlatformActivationFlag(false, async () => {
    const fixture = lifecycleFixture({ status: "PROVISIONING" });
    const service = new PlatformTenantLifecycleService(fixture.prisma);
    await assert.rejects(
      () => service.activate("tenant-1", confirmation, { id: "owner-1" } as never),
      ConflictException,
    );
    assert.equal(fixture.updates.length, 0);
    assert.equal(fixture.auditRows.length, 0);
    assert.equal(fixture.tenant.status, "PROVISIONING");
  });
});

test("activation requires readiness and exact confirmation, then atomically audits without enabling orders", async () => {
  const fixture = lifecycleFixture({ status: "PROVISIONING" });
  const service = new PlatformTenantLifecycleService(fixture.prisma);

  await withPlatformActivationFlag(true, async () => {
    await assert.rejects(
      () => service.activate("tenant-1", { ...confirmation, confirmationCode: "OTHER_CAFE" }, { id: "owner-1" } as never),
      BadRequestException,
    );
    assert.equal(fixture.updates.length, 0);
    assert.equal(fixture.auditRows.length, 0);

    const result = await service.activate("tenant-1", confirmation, { id: "owner-1" } as never);
    assert.equal(result.status, "ACTIVE");
    assert.equal(fixture.tenant.status, "ACTIVE");
    assert.deepEqual(fixture.transactionOptions, { isolationLevel: "Serializable" });
    assert.deepEqual(fixture.updates, [{
      where: { id: "tenant-1", status: "PROVISIONING" },
      data: { status: "ACTIVE" },
    }]);
    assert.equal(fixture.auditRows[0]?.action, "PLATFORM_TENANT_ACTIVATED");
    assert.equal(fixture.auditRows[0]?.userId, "owner-1");
    assert.equal((fixture.auditRows[0]?.metadata as Record<string, unknown>)?.branchesRemainOrderDisabled, true);
  });
});

test("activation refuses to make the protected Mazetto Food tenant mutable", async () => {
  const fixture = lifecycleFixture({ status: "PROVISIONING", code: "MAZETTO_FOOD" });
  const service = new PlatformTenantLifecycleService(fixture.prisma);
  await assert.rejects(
    () => service.activate("tenant-1", { ...confirmation, confirmationCode: "MAZETTO_FOOD" }, { id: "owner-1" } as never),
    ConflictException,
  );
  assert.equal(fixture.updates.length, 0);
});

test("archive preview reports retained branches, orders, payments, users, and customers", async () => {
  const fixture = lifecycleFixture();
  const service = new PlatformTenantLifecycleService(fixture.prisma);
  const preview = await service.archivePreview("tenant-1");

  assert.deepEqual(preview.records, {
    branches: baseRecords.branches,
    domains: baseRecords.domains,
    verifiedDomains: baseRecords.verifiedDomains,
    memberships: baseRecords.memberships,
    customers: baseRecords.customers,
    orders: baseRecords.orders,
    payments: baseRecords.payments,
    openOrders: baseRecords.openOrders,
    openShifts: baseRecords.openShifts,
    pendingCashTransfers: baseRecords.pendingCashTransfers,
    platformSites: baseRecords.platformSites,
  });
  assert.equal(preview.canArchive, true);
  assert.equal(fixture.deleteCalls, 0);
});

test("archive requires the exact tenant code and an audit reason", async () => {
  const fixture = lifecycleFixture();
  const service = new PlatformTenantLifecycleService(fixture.prisma);

  await assert.rejects(
    () => service.archive("tenant-1", { ...confirmation, confirmationCode: "OTHER_CAFE" }, { id: "owner-1" } as never),
    BadRequestException,
  );
  await assert.rejects(
    () => service.archive("tenant-1", { ...confirmation, reason: "short" }, { id: "owner-1" } as never),
    BadRequestException,
  );
  assert.equal(fixture.updates.length, 0);
  assert.equal(fixture.auditRows.length, 0);
});

test("the existing Mazetto Food tenant is protected from archive", async () => {
  const fixture = lifecycleFixture({
    code: "MAZETTO_FOOD",
    domains: ["mazettofood.uz", "pos.mazettofood.uz"],
  });
  const service = new PlatformTenantLifecycleService(fixture.prisma);
  const preview = await service.archivePreview("tenant-1");

  assert.equal(preview.canArchive, false);
  assert.match(preview.blockReason ?? "", /asosiy restorani/i);
  await assert.rejects(
    () => service.archive("tenant-1", { ...confirmation, confirmationCode: "MAZETTO_FOOD" }, { id: "owner-1" } as never),
    ConflictException,
  );
  assert.equal(fixture.updates.length, 0);
});

test("archive refuses to interrupt an open cashier shift", async () => {
  const fixture = lifecycleFixture({ openShifts: 1 });
  const service = new PlatformTenantLifecycleService(fixture.prisma);
  const preview = await service.archivePreview("tenant-1");

  assert.equal(preview.canArchive, false);
  assert.equal(preview.records.openShifts, 1);
  assert.match(preview.blockReason ?? "", /smenalarini yoping/i);
  await assert.rejects(
    () => service.archive("tenant-1", confirmation, { id: "owner-1" } as never),
    /smenalarini yoping/i,
  );
});

test("archive refuses unresolved pending or disputed cash transfers", async () => {
  const fixture = lifecycleFixture({ pendingCashTransfers: 2 });
  const service = new PlatformTenantLifecycleService(fixture.prisma);
  const preview = await service.archivePreview("tenant-1");

  assert.equal(preview.canArchive, false);
  assert.equal(preview.records.pendingCashTransfers, 2);
  assert.match(preview.blockReason ?? "", /pul o'tkazmalarini hal qiling/i);
  await assert.rejects(
    () => service.archive("tenant-1", confirmation, { id: "owner-1" } as never),
    /pul o'tkazmalarini hal qiling/i,
  );
});

test("archive refuses to interrupt open orders", async () => {
  const fixture = lifecycleFixture({ openOrders: 2 });
  const service = new PlatformTenantLifecycleService(fixture.prisma);
  const preview = await service.archivePreview("tenant-1");

  assert.equal(preview.canArchive, false);
  assert.equal(preview.records.openOrders, 2);
  assert.ok(fixture.openOrderStatuses.includes("SERVED"));
  await assert.rejects(
    () => service.archive("tenant-1", confirmation, { id: "owner-1" } as never),
    ConflictException,
  );
  assert.equal(fixture.updates.length, 0);
  assert.equal(fixture.auditRows.length, 0);
});

test("archive surfaces serializable transaction conflicts as a safe conflict", async () => {
  const fixture = lifecycleFixture({ transactionConflict: true });
  const service = new PlatformTenantLifecycleService(fixture.prisma);

  await assert.rejects(
    () => service.archive("tenant-1", confirmation, { id: "owner-1" } as never),
    ConflictException,
  );
  assert.deepEqual(fixture.transactionOptions, { isolationLevel: "Serializable" });
  assert.equal(fixture.updates.length, 0);
  assert.equal(fixture.auditRows.length, 0);
});

test("archive preserves linked data and writes an atomic audit record", async () => {
  const fixture = lifecycleFixture({ status: "PROVISIONING" });
  const service = new PlatformTenantLifecycleService(fixture.prisma);
  const result = await service.archive("tenant-1", confirmation, { id: "owner-1" } as never);

  assert.equal(result.status, "ARCHIVED");
  assert.equal(result.previousStatus, "PROVISIONING");
  assert.deepEqual(fixture.transactionOptions, { isolationLevel: "Serializable" });
  assert.deepEqual(fixture.updates, [{
    where: { id: "tenant-1", status: "PROVISIONING" },
    data: { status: "ARCHIVED" },
  }]);
  assert.equal(fixture.auditRows.length, 1);
  assert.equal(fixture.auditRows[0]?.action, "PLATFORM_TENANT_ARCHIVED");
  assert.equal(fixture.auditRows[0]?.userId, "owner-1");
  assert.equal(fixture.deleteCalls, 0);
});

test("restore returns the tenant to its previous status and is audited", async () => {
  const fixture = lifecycleFixture({
    status: "ARCHIVED",
    archiveMetadata: { previousStatus: "ACTIVE" },
  });
  const service = new PlatformTenantLifecycleService(fixture.prisma);
  const result = await service.restore("tenant-1", confirmation, { id: "owner-1" } as never);

  assert.equal(result.status, "ACTIVE");
  assert.equal(fixture.tenant.status, "ACTIVE");
  assert.deepEqual(fixture.updates, [{
    where: { id: "tenant-1", status: "ARCHIVED" },
    data: { status: "ACTIVE" },
  }]);
  assert.equal(fixture.auditRows[0]?.action, "PLATFORM_TENANT_RESTORED");
});

test("restore refuses archived tenants without lifecycle audit evidence", async () => {
  const fixture = lifecycleFixture({ status: "ARCHIVED" });
  const service = new PlatformTenantLifecycleService(fixture.prisma);

  await assert.rejects(
    () => service.restore("tenant-1", confirmation, { id: "owner-1" } as never),
    ConflictException,
  );
  assert.equal(fixture.updates.length, 0);
});

test("an archived tenant domain is blocked from public tenant routing", async () => {
  const context = new TenantRequestContextService({
    tenantDomain: {
      findMany: async () => [{
        hostname: "north.example.uz",
        status: "VERIFIED",
        tenantId: "tenant-1",
        tenant: { status: "ARCHIVED" },
      }],
    },
  } as never);

  assert.deepEqual(await context.resolve("north.example.uz"), {
    kind: "BLOCKED",
    hostname: "north.example.uz",
  });
});
