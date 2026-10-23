import assert from "node:assert/strict";
import test from "node:test";
import { TenantMembershipAuthService } from "../src/modules/auth/tenant-membership-auth.service";

function activeMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: "membership-a",
    tenantId: "tenant-a",
    branchId: "branch-a",
    tenant: { status: "ACTIVE", features: [{ code: "INVENTORY" }] },
    branch: { tenantId: "tenant-a" },
    user: {
      id: "user-a",
      email: "cashier@example.test",
      phone: null,
      credentialVersion: 2,
      isActive: true,
      employee: {
        id: "employee-a",
        branchId: "branch-a",
        status: "ACTIVE",
        branch: { tenantId: "tenant-a" },
      },
    },
    roles: [
      {
        role: {
          code: "CASHIER",
          isBranchScoped: true,
          permissions: [{ permission: { code: "PAYMENT_CREATE" } }],
        },
      },
    ],
    ...overrides,
  };
}

function createService(record: unknown) {
  return new TenantMembershipAuthService({
    tenantMembership: {
      findFirst: async () => record,
    },
  } as never);
}

test("active restaurant staff membership resolves its branch, role and permissions", async () => {
  const service = createService(activeMembership());

  const user = await service.resolve("user-a", "tenant-a");

  assert.ok(user);
  assert.equal(user.tenantId, "tenant-a");
  assert.equal(user.membershipId, "membership-a");
  assert.deepEqual(user.tenantFeatures, ["INVENTORY"]);
  assert.equal(user.branchId, "branch-a");
  assert.equal(user.employeeId, "employee-a");
  assert.deepEqual(user.roles, ["CASHIER"]);
  assert.deepEqual(user.permissions, ["PAYMENT_CREATE"]);
});

test("membership with no active restaurant role cannot authenticate", async () => {
  const empty = createService(activeMembership({ roles: [] }));
  const platformOnly = createService(
    activeMembership({
      roles: [
        {
          role: {
            code: "PLATFORM_OWNER",
            isBranchScoped: false,
            permissions: [{ permission: { code: "SYSTEM_HEALTH_VIEW" } }],
          },
        },
      ],
    }),
  );

  assert.equal(await empty.resolve("user-a", "tenant-a"), null);
  assert.equal(await platformOnly.resolve("user-a", "tenant-a"), null);
});

test("branch-scoped membership without an active same-tenant employee is rejected", async () => {
  const noEmployee = createService(
    activeMembership({ user: { ...activeMembership().user, employee: null } }),
  );
  const foreignBranch = createService(
    activeMembership({
      user: {
        ...activeMembership().user,
        employee: {
          ...activeMembership().user.employee,
          branch: { tenantId: "tenant-b" },
        },
      },
    }),
  );

  assert.equal(await noEmployee.resolve("user-a", "tenant-a"), null);
  assert.equal(await foreignBranch.resolve("user-a", "tenant-a"), null);
});

test("inactive tenant or user membership is rejected", async () => {
  const inactiveTenant = createService(
    activeMembership({ tenant: { status: "SUSPENDED" } }),
  );
  const inactiveUser = createService(
    activeMembership({ user: { ...activeMembership().user, isActive: false } }),
  );

  assert.equal(await inactiveTenant.resolve("user-a", "tenant-a"), null);
  assert.equal(await inactiveUser.resolve("user-a", "tenant-a"), null);
});
