import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { StaffService } from "../src/modules/staff/staff.service";

type Branch = { id: string; tenantId: string };

function createStaffService(
  branches: Record<string, Branch>,
  activeTenantIds: string[],
) {
  const service = new StaffService(
    {
      branch: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          branches[where.id] ?? null,
      },
      role: {
        findMany: async () => [
          { code: "WAITER", isBranchScoped: true, isSystem: true },
        ],
      },
      restaurantTenant: {
        findMany: async () => activeTenantIds.map((id) => ({ id })),
      },
    } as never,
    {} as never,
  );

  return service as unknown as {
    assertBranchExists(
      branchId: string,
      actor: AuthenticatedUser,
    ): Promise<void>;
    assertCanManageStaffRecord(actor: AuthenticatedUser, target: unknown): Promise<void>;
    resolveBranchForRoles(
      actor: AuthenticatedUser,
      roleCodes: string[],
      requestedBranchId?: string | null,
    ): Promise<string | null>;
  };
}

test("staff branch assignment stays within the actor's tenant", async () => {
  const staff = createStaffService(
    {
      "branch-a": { id: "branch-a", tenantId: "tenant-a" },
      "branch-b": { id: "branch-b", tenantId: "tenant-b" },
      "branch-a2": { id: "branch-a2", tenantId: "tenant-a" },
    },
    ["tenant-a"],
  );
  const actor: AuthenticatedUser = {
    id: "manager",
    branchId: "branch-a",
    isGlobalScope: true,
    roles: ["SUPER_ADMIN"],
    permissions: ["STAFF_CREATE"],
  };

  await staff.assertBranchExists("branch-a2", actor);
  await assert.rejects(
    staff.assertBranchExists("branch-b", actor),
    /another restaurant/,
  );
});

test("unbound global admins are scoped only when exactly one tenant is active", async () => {
  const branch = { "branch-a": { id: "branch-a", tenantId: "tenant-a" } };
  const actor: AuthenticatedUser = {
    id: "root",
    isGlobalScope: true,
    roles: ["SUPER_ADMIN"],
    permissions: ["STAFF_CREATE"],
  };

  await createStaffService(branch, ["tenant-a"]).assertBranchExists(
    "branch-a",
    actor,
  );
  await assert.rejects(
    createStaffService(branch, ["tenant-a", "tenant-b"]).assertBranchExists(
      "branch-a",
      actor,
    ),
    /Tenant context is required/,
  );
});

test("branchless non-global accounts cannot infer a tenant from the active tenant list", async () => {
  const staff = createStaffService(
    { "branch-a": { id: "branch-a", tenantId: "tenant-a" } },
    ["tenant-a"],
  );
  const actor: AuthenticatedUser = {
    id: "unscoped",
    roles: ["WAITER"],
    permissions: ["STAFF_CREATE"],
  };

  await assert.rejects(
    staff.assertBranchExists("branch-a", actor),
    /filialga biriktirilmagan/,
  );
});

test("unknown staff branch IDs remain not found", async () => {
  const staff = createStaffService({}, ["tenant-a"]);
  const actor: AuthenticatedUser = {
    id: "root",
    isGlobalScope: true,
    roles: ["SUPER_ADMIN"],
    permissions: [],
  };

  await assert.rejects(
    staff.assertBranchExists("missing", actor),
    /Branch not found/,
  );
});

test("staff role assignment refuses a branch from another tenant", async () => {
  const staff = createStaffService(
    {
      "branch-a": { id: "branch-a", tenantId: "tenant-a" },
      "branch-b": { id: "branch-b", tenantId: "tenant-b" },
    },
    ["tenant-a"],
  );
  const actor: AuthenticatedUser = {
    id: "manager",
    branchId: "branch-a",
    isGlobalScope: true,
    roles: ["SUPER_ADMIN"],
    permissions: ["STAFF_ROLE_ASSIGN"],
  };

  await assert.rejects(
    staff.resolveBranchForRoles(actor, ["WAITER"], "branch-b"),
    /another restaurant/,
  );
});
test("staff ID workflows deny targets owned by another restaurant", async () => {
  const staff = createStaffService(
    {
      "branch-a": { id: "branch-a", tenantId: "tenant-a" },
      "branch-b": { id: "branch-b", tenantId: "tenant-b" },
    },
    ["tenant-a", "tenant-b"],
  );
  const actor: AuthenticatedUser = {
    id: "owner-a",
    branchId: "branch-a",
    isGlobalScope: true,
    roles: ["SUPER_ADMIN"],
    permissions: ["STAFF_UPDATE"],
  };

  await assert.rejects(
    staff.assertCanManageStaffRecord(actor, {
      roles: [{ role: { code: "WAITER" } }],
      employee: { branchId: "branch-b" },
    }),
    /another restaurant/,
  );
});

test("branch-scoped managers cannot use staff IDs from another branch in their tenant", async () => {
  const staff = createStaffService(
    {
      "branch-a": { id: "branch-a", tenantId: "tenant-a" },
      "branch-a2": { id: "branch-a2", tenantId: "tenant-a" },
    },
    ["tenant-a"],
  );
  const actor: AuthenticatedUser = {
    id: "manager",
    branchId: "branch-a",
    isGlobalScope: false,
    roles: ["BRANCH_MANAGER"],
    permissions: ["STAFF_UPDATE"],
  };

  await staff.assertCanManageStaffRecord(actor, {
    roles: [{ role: { code: "WAITER" } }],
    employee: { branchId: "branch-a" },
  });
  await assert.rejects(
    staff.assertCanManageStaffRecord(actor, {
      roles: [{ role: { code: "WAITER" } }],
      employee: { branchId: "branch-a2" },
    }),
    /Boshqa filialga/,
  );
});

test("unassigned staff records require an unambiguous single restaurant", async () => {
  const branch = { "branch-a": { id: "branch-a", tenantId: "tenant-a" } };
  const actor: AuthenticatedUser = {
    id: "root",
    isGlobalScope: true,
    roles: ["SUPER_ADMIN"],
    permissions: ["STAFF_UPDATE"],
  };
  const unassignedStaff = {
    roles: [{ role: { code: "SUPER_ADMIN" } }],
    employee: null,
  };

  await createStaffService(branch, ["tenant-a"]).assertCanManageStaffRecord(
    actor,
    unassignedStaff,
  );
  await assert.rejects(
    createStaffService(branch, ["tenant-a", "tenant-b"])
      .assertCanManageStaffRecord(actor, unassignedStaff),
    /Tenant context is required/,
  );
});
