import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { StaffService } from "../src/modules/staff/staff.service";

function makeService(input: {
  branchTenantId?: string;
  activeTenantIds?: string[];
  membership?: { id: string; status: "ACTIVE" | "SUSPENDED" } | null;
}) {
  const writes: { kind: string; data?: unknown }[] = [];
  const tx = {
    branch: {
      findUnique: async () => input.branchTenantId ? { tenantId: input.branchTenantId } : null,
    },
    restaurantTenant: {
      findMany: async () => (input.activeTenantIds ?? []).map((id) => ({ id })),
    },
    tenantMembership: {
      findUnique: async () => input.membership ?? null,
      create: async ({ data }: { data: unknown }) => {
        writes.push({ kind: "membership.create", data });
        return { id: "membership-created" };
      },
      update: async ({ data }: { data: unknown }) => {
        writes.push({ kind: "membership.update", data });
        return { id: input.membership?.id };
      },
    },
    tenantMembershipRole: {
      deleteMany: async ({ where }: { where: unknown }) => {
        writes.push({ kind: "roles.delete", data: where });
        return { count: 2 };
      },
      createMany: async ({ data }: { data: unknown }) => {
        writes.push({ kind: "roles.create", data });
        return { count: 1 };
      },
    },
  };
  const service = new StaffService({} as never, {} as never) as unknown as {
    syncTenantMembershipRoles(
      client: typeof tx,
      userId: string,
      roles: { id: string; code: string }[],
      branchId: string | null,
      assignedById: string,
    ): Promise<void>;
  };
  return { service, tx, writes };
}

test("staff creation provisions branch membership roles for the branch tenant", async () => {
  const { service, tx, writes } = makeService({ branchTenantId: "tenant-a" });
  await service.syncTenantMembershipRoles(
    tx,
    "user-a",
    [{ id: "role-cashier", code: "CASHIER" }],
    "branch-a",
    "owner",
  );

  assert.deepEqual(writes[0], {
    kind: "membership.create",
    data: { tenantId: "tenant-a", userId: "user-a", branchId: "branch-a", status: "ACTIVE" },
  });
  assert.deepEqual(writes[2], {
    kind: "roles.create",
    data: [{ membershipId: "membership-created", roleId: "role-cashier", assignedById: "owner" }],
  });
});

test("staff role changes replace membership roles without reactivating a suspended membership", async () => {
  const { service, tx, writes } = makeService({
    branchTenantId: "tenant-a",
    membership: { id: "membership-a", status: "SUSPENDED" },
  });
  await service.syncTenantMembershipRoles(
    tx,
    "user-a",
    [{ id: "role-manager", code: "BRANCH_MANAGER" }],
    "branch-a",
    "owner",
  );

  assert.deepEqual(writes[0], {
    kind: "membership.update",
    data: { branchId: "branch-a" },
  });
  assert.deepEqual(writes[2], {
    kind: "roles.create",
    data: [{ membershipId: "membership-a", roleId: "role-manager", assignedById: "owner" }],
  });
});

test("platform roles cannot be copied into tenant memberships", async () => {
  const { service, tx, writes } = makeService({ branchTenantId: "tenant-a" });
  await assert.rejects(
    service.syncTenantMembershipRoles(
      tx,
      "user-a",
      [{ id: "platform-role", code: "PLATFORM_OWNER" }],
      "branch-a",
      "owner",
    ),
    /Platform roles cannot be assigned/,
  );
  assert.equal(writes.length, 0);
});

test("branchless staff role sync fails closed when tenant selection is ambiguous", async () => {
  const { service, tx, writes } = makeService({ activeTenantIds: ["tenant-a", "tenant-b"] });
  await assert.rejects(
    service.syncTenantMembershipRoles(
      tx,
      "user-a",
      [{ id: "role-super", code: "SUPER_ADMIN" }],
      null,
      "owner",
    ),
    ForbiddenException,
  );
  assert.equal(writes.length, 0);
});
