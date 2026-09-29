import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { BranchesService } from "../src/modules/branches/branches.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: ["BRANCH_VIEW", "BRANCH_CREATE", "BRANCH_EDIT"],
};


test("global branch list is restricted to the actor's sole active tenant", async () => {
  let where: unknown;
  const service = new BranchesService({
    branch: {
      findMany: async (args: { where: unknown }) => {
        where = args.where;
        return [];
      },
    },
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
  } as never);

  await service.listBranches(owner);
  assert.deepEqual(where, { tenantId: "tenant-a" });
});

test("foreign tenant branch IDs resolve as not found", async () => {
  let where: unknown;
  const service = new BranchesService({
    branch: {
      findFirst: async (args: { where: unknown }) => {
        where = args.where;
        return null;
      },
    },
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
  } as never);

  await assert.rejects(service.getBranch("branch-b", owner), /Branch not found/);
  assert.deepEqual(where, { id: "branch-b", tenantId: "tenant-a" });
});

test("new branches are explicitly connected to the resolved tenant", async () => {
  let createData: unknown;
  const service = new BranchesService({
    branch: {
      findFirst: async () => null,
      create: async (args: { data: unknown }) => {
        createData = args.data;
        return args.data;
      },
    },
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
  } as never);
  const dto = {
    code: "new-branch",
    name: "New Branch",
    timezone: "Asia/Tashkent",
    isActive: true,
    isTemporarilyClosed: false,
    acceptsOrders: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    sortOrder: 0,
  };

  await service.createBranch(dto, owner);
  assert.deepEqual((createData as { tenant: unknown }).tenant, {
    connect: { id: "tenant-a" },
  });
});

test("bulk branch deletion cannot resolve foreign tenant IDs", async () => {
  let where: unknown;
  let transactionCalled = false;
  const service = new BranchesService({
    branch: {
      findMany: async (args: { where: unknown }) => {
        where = args.where;
        return [];
      },
    },
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
    $transaction: async () => {
      transactionCalled = true;
    },
  } as never);

  await assert.rejects(
    service.permanentlyDeleteBranches(["branch-b"], owner),
    /Branch not found/,
  );
  assert.deepEqual(where, { id: { in: ["branch-b"] }, tenantId: "tenant-a" });
  assert.equal(transactionCalled, false);
});

test("branch-scoped users cannot read another branch in their tenant", async () => {
  let branchLookupCount = 0;
  const service = new BranchesService({
    branch: {
      findUnique: async () => {
        branchLookupCount += 1;
        return { tenantId: "tenant-a" };
      },
      findFirst: async () => null,
    },
  } as never);
  const manager: AuthenticatedUser = {
    id: "manager-a",
    branchId: "branch-a",
    isGlobalScope: false,
    roles: ["BRANCH_MANAGER"],
    permissions: ["BRANCH_VIEW"],
  };

  await assert.rejects(service.getBranch("branch-a2", manager), /Boshqa filialga/);
  assert.equal(branchLookupCount, 1);
});
test("customer branch list is restricted to the trusted tenant", async () => {
  let where: unknown;
  const service = new BranchesService({
    branch: {
      findMany: async (args: { where: unknown }) => {
        where = args.where;
        return [];
      },
    },
    restaurantTenant: {
      findFirst: async () => ({ id: "tenant-a" }),
    },
  } as never);

  await service.listCustomerBranches("tenant-a");
  assert.deepEqual(where, { isActive: true, tenantId: "tenant-a" });
});

test("customer branch list fails closed when the trusted tenant is inactive", async () => {
  let branchQueryCount = 0;
  const service = new BranchesService({
    branch: {
      findMany: async () => {
        branchQueryCount += 1;
        return [];
      },
    },
    restaurantTenant: {
      findFirst: async () => null,
    },
  } as never);

  await assert.rejects(
    service.listCustomerBranches("tenant-a"),
    /Restaurant not found/,
  );
  assert.equal(branchQueryCount, 0);
});

test("customer order branch validation includes the trusted tenant", async () => {
  let where: unknown;
  const service = new BranchesService({
    branch: {
      findFirst: async (args: { where: unknown }) => {
        where = args.where;
        return null;
      },
    },
    restaurantTenant: {
      findFirst: async () => ({ id: "tenant-a" }),
    },
  } as never);

  await assert.rejects(
    service.assertCustomerBranchAcceptsOrder("branch-b", "PICKUP", "tenant-a"),
    /Branch not found/,
  );
  assert.deepEqual(where, {
    id: "branch-b",
    isActive: true,
    tenantId: "tenant-a",
  });
});

test("customer order validation rejects an inactive tenant before branch lookup", async () => {
  let branchQueryCount = 0;
  const service = new BranchesService({
    branch: {
      findFirst: async () => {
        branchQueryCount += 1;
        return null;
      },
    },
    restaurantTenant: {
      findFirst: async () => null,
    },
  } as never);

  await assert.rejects(
    service.assertCustomerBranchAcceptsOrder("branch-b", "PICKUP", "tenant-a"),
    /Restaurant not found/,
  );
  assert.equal(branchQueryCount, 0);
});
test("duplicate branch code errors do not reveal another tenant's branch name", async () => {
  let select: unknown;
  const service = new BranchesService({
    branch: {
      findFirst: async (args: { select: unknown }) => {
        select = args.select;
        return { id: "foreign-branch", name: "Private Restaurant Branch" };
      },
    },
  } as never);
  const internals = service as unknown as {
    assertCodeAvailable(code: string): Promise<void>;
  };

  await assert.rejects(
    internals.assertCodeAvailable("MAIN"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /already in use/);
      assert.doesNotMatch(error.message, /Private Restaurant Branch/);
      return true;
    },
  );
  assert.deepEqual(select, { id: true });
});
test("catalog branch IDs are verified against the active tenant", async () => {
  let where: unknown;
  const service = new BranchesService({
    branch: {
      findFirst: async (args: { where: unknown }) => {
        where = args.where;
        return null;
      },
    },
    restaurantTenant: {
      findFirst: async () => ({ id: "tenant-a" }),
    },
  } as never);

  await assert.rejects(
    service.resolveCustomerTenantId("branch-b", "tenant-a"),
    /Branch not found/,
  );
  assert.deepEqual(where, {
    id: "branch-b",
    isActive: true,
    tenantId: "tenant-a",
  });
});
