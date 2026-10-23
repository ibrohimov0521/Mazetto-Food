import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { TENANT_FEATURES } from "../src/common/tenant/tenant-feature-catalog";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { PlatformTenantFeatureService } from "../src/modules/platform-monitoring/platform-tenant-feature.service";
import { PlatformTenantProvisioningService } from "../src/modules/platform-monitoring/platform-tenant-provisioning.service";

function makeService(initialEnabledCodes: string[] = []) {
  const enabled = new Set<string>(initialEnabledCodes);
  const disconnected: string[] = [];
  const transactionClient = {
    restaurantTenant: { findUnique: async () => ({ id: "tenant-a" }) },
    tenantFeature: {
      upsert: async (args: {
        where: { tenantId_code: { code: string } };
        create: { isEnabled: boolean };
        update: { isEnabled: boolean };
      }) => {
        const { code } = args.where.tenantId_code;
        if (args.create.isEnabled || args.update.isEnabled) enabled.add(code);
        else enabled.delete(code);
        return { code, isEnabled: enabled.has(code) };
      },
    },
    auditLog: { create: async () => ({}) },
  };
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transactionClient),
    restaurantTenant: { findUnique: async () => ({ id: "tenant-a" }) },
    tenantFeature: { findMany: async () => [...enabled].map((code) => ({ code })) },
  };
  const gateway = {
    disconnectTenantFeature: (_tenantId: string, featureCode: string) => disconnected.push(featureCode),
  };
  return {
    disconnected,
    service: new PlatformTenantFeatureService(prisma as never, gateway as never),
  };
}

test("disabling customer web and kitchen persists flags then disconnects their tenant sockets", async () => {
  const { disconnected, service } = makeService();
  const result = await service.replace(
    "tenant-a",
    ["INVENTORY"],
    { id: "platform-owner" } as AuthenticatedUser,
  );

  assert.deepEqual(disconnected.sort(), ["CUSTOMER_WEB", "KITCHEN_DISPLAY"]);
  assert.equal(result.find(({ code }) => code === "CUSTOMER_WEB")?.isEnabled, false);
  assert.equal(result.find(({ code }) => code === "KITCHEN_DISPLAY")?.isEnabled, false);
  assert.equal(result.find(({ code }) => code === "INVENTORY")?.isEnabled, true);
});

test("web orders cannot be enabled without customer website", async () => {
  const { disconnected, service } = makeService();
  await assert.rejects(
    () => service.replace("tenant-a", ["WEB_ORDERS"], { id: "platform-owner" } as AuthenticatedUser),
    BadRequestException,
  );
  assert.deepEqual(disconnected, []);
});

test("each feature can be disabled without changing unrelated features", async () => {
  const allCodes = TENANT_FEATURES.map(({ code }) => code);
  for (const code of allCodes) {
    const { service } = makeService(allCodes);
    const desired = new Set(allCodes);
    desired.delete(code);
    if (code === "CUSTOMER_WEB") desired.delete("WEB_ORDERS");
    if (code === "KITCHEN_DISPLAY") desired.delete("TV_DISPLAY");
    const result = await service.replace(
      "tenant-a",
      [...desired],
      { id: "platform-owner" } as AuthenticatedUser,
    );
    for (const feature of result) {
      assert.equal(feature.isEnabled, desired.has(feature.code), `${code} toggle changed ${feature.code}`);
    }
  }
});

test("disabling TV display leaves kitchen enabled; TV cannot be enabled without kitchen", async () => {
  const allCodes = TENANT_FEATURES.map(({ code }) => code);
  const { service, disconnected } = makeService(allCodes);
  const withoutTv = await service.replace(
    "tenant-a",
    allCodes.filter((code) => code !== "TV_DISPLAY"),
    { id: "platform-owner" } as AuthenticatedUser,
  );
  assert.equal(withoutTv.find(({ code }) => code === "TV_DISPLAY")?.isEnabled, false);
  assert.equal(withoutTv.find(({ code }) => code === "KITCHEN_DISPLAY")?.isEnabled, true);
  assert.deepEqual(disconnected, []);
  await assert.rejects(
    () => service.replace("tenant-a", allCodes.filter((code) => code !== "KITCHEN_DISPLAY"), { id: "platform-owner" } as AuthenticatedUser),
    BadRequestException,

  );
});
test("onboarding rejects TV display without kitchen before creating a tenant", async () => {
  let transactionCalls = 0;
  const service = new PlatformTenantProvisioningService({
    $transaction: async () => {
      transactionCalls += 1;
      throw new Error("A database transaction must not start.");
    },
  } as never);
  await assert.rejects(
    () => service.provision({
      code: "TEST_TV",
      name: "TV test restaurant",
      ownerName: "Test Owner",
      ownerLogin: "tv-owner@example.invalid",
      ownerPassword: "testing-only-password",
      branchCode: "MAIN",
      branchName: "Main branch",
      subdomain: "tv-test",
      enabledFeatureCodes: ["TV_DISPLAY"],
    } as never, { id: "platform-owner" } as AuthenticatedUser),
    BadRequestException,
  );
  assert.equal(transactionCalls, 0);
});

test("synthetic test restaurant provisions TV display and can switch it off independently", async () => {
  const tenantId = "tenant-test-tv";
  const featureRows = new Map<string, boolean>();
  const roles = { id: "role-super-admin", isActive: true, isBranchScoped: false };
  const transaction = {
    restaurantTenant: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: tenantId, ...data, createdAt: new Date(), updatedAt: new Date() }),
      findUnique: async ({ where }: { where: { id: string } }) => where.id === tenantId ? { id: tenantId } : null,
    },
    user: {
      findFirst: async () => null,
      create: async ({ data }: { data: { displayName: string; email?: string; phone?: string } }) => ({ id: "owner-test", displayName: data.displayName, email: data.email ?? null, phone: data.phone ?? null }),
    },
    role: { findUnique: async () => roles },
    branch: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "branch-test", ...data }) },
    tenantMembership: { create: async () => ({ id: "membership-test" }) },
    tenantFeature: {
      createMany: async ({ data }: { data: Array<{ tenantId: string; code: string; isEnabled: boolean }> }) => {
        for (const feature of data) featureRows.set(`${feature.tenantId}:${feature.code}`, feature.isEnabled);
      },
      upsert: async ({ where, create, update }: { where: { tenantId_code: { tenantId: string; code: string } }; create: { isEnabled: boolean }; update: { isEnabled: boolean } }) => {
        const { tenantId: id, code } = where.tenantId_code;
        const isEnabled = update.isEnabled ?? create.isEnabled;
        featureRows.set(`${id}:${code}`, isEnabled);
        return { code, isEnabled };
      },
    },
    tenantDomain: { create: async ({ data }: { data: { hostname: string } }) => ({ id: "domain-test", hostname: data.hostname, status: "PENDING", verifiedAt: null }) },
    auditLog: { create: async () => ({ id: "audit-test" }) },
  };
  const database = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction),
    restaurantTenant: { findUnique: async ({ where }: { where: { id: string } }) => where.id === tenantId ? { id: tenantId } : null },
    tenantFeature: {
      findMany: async ({ where }: { where: { tenantId: string; isEnabled: boolean } }) => TENANT_FEATURES
        .filter(({ code }) => featureRows.get(`${where.tenantId}:${code}`) === where.isEnabled)
        .map(({ code }) => ({ code })),
    },
  };
  const actor = { id: "platform-owner" } as AuthenticatedUser;
  const created = await new PlatformTenantProvisioningService(database as never).provision({
    code: "TEST_TV",
    name: "TV test restaurant",
    ownerName: "Test Owner",
    ownerLogin: "tv-owner@example.invalid",
    ownerPassword: "testing-only-password",
    branchCode: "MAIN",
    branchName: "Main branch",
    subdomain: "tv-test",
    enabledFeatureCodes: TENANT_FEATURES.map(({ code }) => code),
  } as never, actor);
  assert.equal(created.tenant.status, "PROVISIONING");
  assert.equal(featureRows.get(`${tenantId}:TV_DISPLAY`), true);
  const disconnected: string[] = [];
  const featureService = new PlatformTenantFeatureService(database as never, { disconnectTenantFeature: (_id: string, code: string) => disconnected.push(code) } as never);
  const updated = await featureService.replace(tenantId, TENANT_FEATURES.filter(({ code }) => code !== "TV_DISPLAY").map(({ code }) => code), actor);
  assert.equal(updated.find(({ code }) => code === "TV_DISPLAY")?.isEnabled, false);
  assert.equal(updated.find(({ code }) => code === "KITCHEN_DISPLAY")?.isEnabled, true);
  assert.deepEqual(disconnected, []);
});
