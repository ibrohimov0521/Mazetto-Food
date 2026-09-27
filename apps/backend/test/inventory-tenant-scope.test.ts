import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { InventoryService } from "../src/modules/inventory/inventory.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

test("warehouse and stock queries are filtered to the resolved restaurant tenant", async () => {
  const filters = new Map<string, Record<string, unknown>>();
  const service = new InventoryService({
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
    warehouse: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.set("warehouses", args.where);
        return [];
      },
    },
    stock: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.set("stock", args.where);
        return [];
      },
    },
    stockMovement: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        filters.set("movements", args.where);
        return [];
      },
    },
  } as never);

  await service.listWarehouses(owner);
  await service.getStock({} as never, owner);
  await service.getMovements({} as never, owner);
  await service.getCost({} as never, owner);

  assert.deepEqual(
    (filters.get("warehouses")?.branch as Record<string, unknown>),
    { tenantId: "tenant-a" },
  );
  for (const key of ["stock", "movements"]) {
    const warehouse = filters.get(key)?.warehouse as Record<string, unknown>;
    assert.deepEqual(warehouse.branch, { tenantId: "tenant-a" });
  }
  const costWarehouse = filters.get("stock")?.warehouse as Record<string, unknown>;
  assert.deepEqual(costWarehouse.branch, { tenantId: "tenant-a" });
});

test("global ingredient catalog fails closed once multiple restaurants are active", async () => {
  let ingredientReads = 0;
  let ingredientWrites = 0;
  const service = new InventoryService({
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
    },
    ingredient: {
      findMany: async () => {
        ingredientReads += 1;
        return [];
      },
      create: async () => {
        ingredientWrites += 1;
        return {};
      },
    },
  } as never);

  await assert.rejects(service.listIngredients(), /Tenant context is required/);
  await assert.rejects(
    service.createIngredient({ name: "Unassigned", unit: "KG" } as never),
    /Tenant context is required/,
  );
  assert.equal(ingredientReads, 0);
  assert.equal(ingredientWrites, 0);
});

test("warehouse creation cannot attach data to a foreign restaurant branch", async () => {
  let creates = 0;
  let lookup: unknown;
  const service = new InventoryService({
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
    branch: {
      findFirst: async (args: { where: unknown }) => {
        lookup = args.where;
        return null;
      },
    },
    warehouse: {
      create: async () => {
        creates += 1;
        return {};
      },
    },
  } as never);

  await assert.rejects(
    service.createWarehouse({ branchId: "branch-b", name: "Warehouse" } as never, owner),
    /Branch not found/,
  );
  assert.deepEqual(lookup, { id: "branch-b", tenantId: "tenant-a" });
  assert.equal(creates, 0);
});
