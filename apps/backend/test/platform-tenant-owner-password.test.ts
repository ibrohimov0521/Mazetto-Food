import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { compare } from "bcryptjs";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { PlatformTenantOwnerPasswordService } from "../src/modules/platform-monitoring/platform-tenant-owner-password.service";
import { PlatformTenantLifecycleController } from "../src/modules/platform-monitoring/platform-tenant-lifecycle.controller";

const platformActor: AuthenticatedUser = {
  id: "platform-owner-1",
  employeeId: "platform-employee-1",
  branchId: "platform-branch-1",
  roles: ["PLATFORM_OWNER"],
  permissions: ["SYSTEM_HEALTH_VIEW"],
};

function serviceHarness(overrides: {
  membership?: unknown;
  tenant?: unknown;
} = {}) {
  let userUpdate: unknown;
  let sessionUpdate: unknown;
  let audit: unknown;
  const invalidated: string[] = [];
  const disconnected: string[] = [];
  const tx = {
    restaurantTenant: {
      findUnique: async () => overrides.tenant === undefined
        ? { id: "tenant-1", code: "BEST", name: "Best Foods", status: "PROVISIONING" }
        : overrides.tenant,
    },
    tenantMembership: {
      findFirst: async () => overrides.membership === undefined
        ? { user: { id: "owner-1", isActive: true } }
        : overrides.membership,
    },
    user: {
      updateMany: async (args: unknown) => { userUpdate = args; return { count: 1 }; },
    },
    session: {
      updateMany: async (args: unknown) => { sessionUpdate = args; return { count: 3 }; },
    },
    auditLog: {
      create: async (args: unknown) => { audit = args; return {}; },
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new PlatformTenantOwnerPasswordService(
    prisma as never,
    { invalidate: async (id: string) => { invalidated.push(id); } } as never,
    { disconnectStaffUser: (id: string) => { disconnected.push(id); } } as never,
  );
  return {
    service,
    getUserUpdate: () => userUpdate,
    getSessionUpdate: () => sessionUpdate,
    getAudit: () => audit,
    invalidated,
    disconnected,
  };
}

test("platform owner reset updates only an active tenant owner, revokes sessions and audits without the password", async () => {
  const harness = serviceHarness();
  const password = "a-new-secure-password";
  const result = await harness.service.resetPassword("tenant-1", "owner-1", {
    newPassword: password,
    confirmation: password,
  }, platformActor);

  assert.deepEqual(result, { changed: true, revokedSessions: 3 });
  const userUpdate = harness.getUserUpdate() as { where: unknown; data: Record<string, unknown> };
  assert.deepEqual(userUpdate.where, { id: "owner-1", isActive: true });
  assert.deepEqual(userUpdate.data.credentialVersion, { increment: 1 });
  assert.notEqual(userUpdate.data.passwordHash, password);
  assert.equal(await compare(password, String(userUpdate.data.passwordHash)), true);
  assert.deepEqual(harness.getSessionUpdate(), {
    where: { userId: "owner-1", revokedAt: null },
    data: { revokedAt: (harness.getSessionUpdate() as { data: { revokedAt: Date } }).data.revokedAt },
  });
  assert.ok((harness.getSessionUpdate() as { data: { revokedAt: unknown } }).data.revokedAt instanceof Date);
  const audit = harness.getAudit() as { data: { userId: string; tenantId: string; action: string; metadata: Record<string, unknown> } };
  assert.equal(audit.data.userId, platformActor.id);
  assert.equal(audit.data.tenantId, "tenant-1");
  assert.equal(audit.data.action, "PLATFORM_TENANT_OWNER_PASSWORD_RESET");
  assert.equal(audit.data.metadata.revokedSessions, 3);
  assert.equal(JSON.stringify(audit).includes(password), false);
  assert.deepEqual(harness.invalidated, ["owner-1"]);
  assert.deepEqual(harness.disconnected, ["owner-1"]);
});

test("platform owner reset rejects mismatched or short passwords before writing", async () => {
  const harness = serviceHarness();
  await assert.rejects(harness.service.resetPassword("tenant-1", "owner-1", {
    newPassword: "short",
    confirmation: "different",
  }, platformActor), BadRequestException);
  assert.equal(harness.getUserUpdate(), undefined);
  assert.deepEqual(harness.invalidated, []);
});

test("platform owner reset cannot target a user without an active SUPER_ADMIN membership", async () => {
  const harness = serviceHarness({ membership: null });
  await assert.rejects(harness.service.resetPassword("tenant-1", "staff-1", {
    newPassword: "a-new-secure-password",
    confirmation: "a-new-secure-password",
  }, platformActor), NotFoundException);
  assert.equal(harness.getUserUpdate(), undefined);
  assert.equal(harness.getAudit(), undefined);
  assert.deepEqual(harness.invalidated, []);
});

test("platform owner reset cannot be used to reset the actor's own account", async () => {
  const harness = serviceHarness();
  await assert.rejects(harness.service.resetPassword("tenant-1", platformActor.id, {
    newPassword: "a-new-secure-password",
    confirmation: "a-new-secure-password",
  }, platformActor), BadRequestException);
  assert.equal(harness.getUserUpdate(), undefined);
});


test("platform owner reset is blocked for archived tenants", async () => {
  const harness = serviceHarness({ tenant: { id: "tenant-1", code: "BEST", name: "Best Foods", status: "ARCHIVED" } });
  await assert.rejects(harness.service.resetPassword("tenant-1", "owner-1", {
    newPassword: "a-new-secure-password",
    confirmation: "a-new-secure-password",
  }, platformActor), ConflictException);
  assert.equal(harness.getUserUpdate(), undefined);
  assert.deepEqual(harness.invalidated, []);
});


test("owner password reset routes inherit platform-owner role and permission guards", () => {
  const reflector = new Reflector();
  assert.deepEqual(reflector.get<string[]>(ROLES_KEY, PlatformTenantLifecycleController), ["PLATFORM_OWNER"]);
  assert.deepEqual(reflector.get<string[]>(PERMISSIONS_KEY, PlatformTenantLifecycleController), ["SYSTEM_HEALTH_VIEW"]);
});
