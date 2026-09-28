import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import {
  resolveRestaurantScope,
  resolveRestaurantTenantId,
  resolveSoleActiveTenantId,
  type TenantScopeDatabase,
} from "../src/common/auth/tenant-scope";

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    roles: ["SUPER_ADMIN"],
    permissions: [],
    isGlobalScope: true,
    ...overrides,
  };
}

function mockDatabase(
  options: {
    activeTenantIds?: string[];
    actorBranchTenantId?: string | null;
    branches?: Array<{ id: string; tenantId: string }>;
  } = {},
) {
  const tenantQueries: unknown[] = [];
  const branchQueries: unknown[] = [];
  const database = {
    restaurantTenant: {
      findMany: async (query: unknown) => {
        tenantQueries.push(query);
        return (options.activeTenantIds ?? []).map((id) => ({ id }));
      },
      findFirst: async (query: { where: { id: string; status: "ACTIVE" } }) => {
        tenantQueries.push(query);
        return options.activeTenantIds?.includes(query.where.id)
          ? { id: query.where.id }
          : null;
      },
    },
    branch: {
      findUnique: async (query: { where: { id: string } }) => {
        branchQueries.push(query);
        return options.actorBranchTenantId
          ? { tenantId: options.actorBranchTenantId }
          : null;
      },
      findFirst: async (query: { where: { id: string; tenantId: string } }) => {
        branchQueries.push(query);
        return (
          (options.branches ?? []).find(
            (branch) =>
              branch.id === query.where.id &&
              branch.tenantId === query.where.tenantId,
          ) ?? null
        );
      },
    },
  } as unknown as TenantScopeDatabase;

  return { database, tenantQueries, branchQueries };
}

test("sole-tenant resolution fails closed when there are no active tenants", async () => {
  const { database, tenantQueries } = mockDatabase();

  await assert.rejects(resolveSoleActiveTenantId(database), ForbiddenException);
  assert.deepEqual(tenantQueries, [
    {
      where: { status: "ACTIVE" },
      select: { id: true },
      take: 2,
    },
  ]);
});

test("sole-tenant resolution returns the only active tenant", async () => {
  const { database, tenantQueries } = mockDatabase({
    activeTenantIds: ["tenant-a"],
  });

  assert.equal(await resolveSoleActiveTenantId(database), "tenant-a");
  assert.deepEqual(tenantQueries, [
    {
      where: { status: "ACTIVE" },
      select: { id: true },
      take: 2,
    },
  ]);
});

test("sole-tenant resolution fails closed when a second active tenant exists", async () => {
  const { database } = mockDatabase({
    activeTenantIds: ["tenant-a", "tenant-b"],
  });

  await assert.rejects(resolveSoleActiveTenantId(database), ForbiddenException);
});
test("tenant-bound global membership resolves its own tenant with multiple active restaurants", async () => {
  const { database, tenantQueries } = mockDatabase({
    activeTenantIds: ["tenant-a", "tenant-b"],
  });
  const user = actor({ tenantId: "tenant-a", membershipId: "membership-a" });

  assert.equal(await resolveRestaurantTenantId(database, user), "tenant-a");
  assert.deepEqual(tenantQueries, [
    {
      where: { id: "tenant-a", status: "ACTIVE" },
      select: { id: true },
    },
  ]);
});

test("tenant-bound membership cannot fall back when its tenant is inactive", async () => {
  const { database, tenantQueries } = mockDatabase({
    activeTenantIds: ["tenant-b"],
  });

  await assert.rejects(
    resolveRestaurantTenantId(
      database,
      actor({ tenantId: "tenant-a", membershipId: "membership-a" }),
    ),
    ForbiddenException,
  );
  assert.deepEqual(tenantQueries, [
    {
      where: { id: "tenant-a", status: "ACTIVE" },
      select: { id: true },
    },
  ]);
});

test("tenant-bound branch membership rejects a branch from another tenant", async () => {
  const { database, branchQueries } = mockDatabase({
    activeTenantIds: ["tenant-a", "tenant-b"],
    branches: [{ id: "branch-a", tenantId: "tenant-a" }],
  });

  await assert.rejects(
    resolveRestaurantTenantId(
      database,
      actor({
        tenantId: "tenant-b",
        membershipId: "membership-b",
        branchId: "branch-a",
        isGlobalScope: false,
      }),
    ),
    ForbiddenException,
  );
  assert.deepEqual(branchQueries, [
    {
      where: { id: "branch-a", tenantId: "tenant-b" },
      select: { id: true },
    },
  ]);
});

test("partial tenant membership identity fails before any tenant query", async () => {
  const { database, tenantQueries } = mockDatabase({
    activeTenantIds: ["tenant-a"],
  });

  await assert.rejects(
    resolveRestaurantTenantId(database, actor({ tenantId: "tenant-a" })),
    ForbiddenException,
  );
  assert.deepEqual(tenantQueries, []);
});

test("branch-assigned actors resolve tenant from their authenticated branch", async () => {
  const { database, tenantQueries, branchQueries } = mockDatabase({
    actorBranchTenantId: "tenant-a",
  });

  assert.equal(
    await resolveRestaurantTenantId(database, actor({ branchId: "branch-a" })),
    "tenant-a",
  );
  assert.deepEqual(branchQueries, [
    { where: { id: "branch-a" }, select: { tenantId: true } },
  ]);
  assert.deepEqual(tenantQueries, []);
});

test("a stale actor branch fails closed instead of falling back to another tenant", async () => {
  const { database, tenantQueries } = mockDatabase({
    activeTenantIds: ["tenant-a"],
  });

  await assert.rejects(
    resolveRestaurantTenantId(database, actor({ branchId: "deleted-branch" })),
    ForbiddenException,
  );
  assert.deepEqual(tenantQueries, []);
});

test("branch-assigned actors cannot widen access to another branch", async () => {
  const { database, branchQueries } = mockDatabase({
    actorBranchTenantId: "tenant-a",
  });

  await assert.rejects(
    resolveRestaurantScope(
      database,
      actor({ branchId: "branch-a", isGlobalScope: false }),
      "branch-b",
    ),
    ForbiddenException,
  );
  assert.deepEqual(branchQueries, [
    { where: { id: "branch-a" }, select: { tenantId: true } },
  ]);
});

test("global restaurant scope still constrains requested branches to the resolved tenant", async () => {
  const { database, branchQueries } = mockDatabase({
    activeTenantIds: ["tenant-a"],
    branches: [{ id: "branch-a", tenantId: "tenant-a" }],
  });

  assert.deepEqual(
    await resolveRestaurantScope(database, actor(), "branch-a"),
    {
      tenantId: "tenant-a",
      branchId: "branch-a",
    },
  );
  assert.deepEqual(branchQueries, [
    {
      where: { id: "branch-a", tenantId: "tenant-a" },
      select: { id: true },
    },
  ]);
});
test("global restaurant scope cannot address a branch outside its tenant", async () => {
  const { database, branchQueries } = mockDatabase({
    activeTenantIds: ["tenant-a"],
  });

  await assert.rejects(
    resolveRestaurantScope(database, actor(), "branch-b"),
    NotFoundException,
  );
  assert.deepEqual(branchQueries, [
    {
      where: { id: "branch-b", tenantId: "tenant-a" },
      select: { id: true },
    },
  ]);
});
