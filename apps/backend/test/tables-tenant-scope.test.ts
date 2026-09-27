import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { TablesService } from "../src/modules/tables/tables.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

test("hall, table, and permanent-delete queries are tenant filtered", async () => {
  const filters = new Map<string, Record<string, unknown>>();
  const tenant = {
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
    hall: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.set("halls", args.where);
        return [{ id: "hall-a", branchId: "branch-a", _count: { tables: 0 } }];
      },
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        filters.set("deleteHalls", args.where);
        return { count: 1 };
      },
    },
    restaurantTable: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.set("tables", args.where);
        return [];
      },
    },
  };
  const service = new TablesService(tenant as never, {} as never);

  await service.listHalls(undefined, owner);
  await service.listTables(undefined, owner);
  assert.deepEqual(filters.get("halls")?.branch, { tenantId: "tenant-a" });
  assert.deepEqual(filters.get("tables")?.branch, { tenantId: "tenant-a" });

  await service.permanentlyDeleteHalls(["hall-a"], owner);
  assert.deepEqual(filters.get("deleteHalls"), {
    id: { in: ["hall-a"] },
    branch: { tenantId: "tenant-a" },
  });
});

test("ambiguous active tenants are rejected before table data is queried", async () => {
  let hallReads = 0;
  const service = new TablesService(
    {
      restaurantTenant: {
        findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
      },
      hall: {
        findMany: async () => {
          hallReads += 1;
          return [];
        },
      },
    } as never,
    {} as never,
  );

  await assert.rejects(service.listHalls(undefined, owner));
  assert.equal(hallReads, 0);
});
