import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { InventoryService } from "../src/modules/inventory/inventory.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

function makeWarehouseService(options: {
  activeWarehouseCount: number;
  recipeVariantCount: number;
  nonZeroStock?: number;
}) {
  const audits: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: async () => [],
    auditLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        audits.push(args.data);
        return args.data;
      },
    },
    stock: { count: async () => options.nonZeroStock ?? 0 },
    warehouse: {
      findFirst: async () => ({ id: "warehouse-a" }),
      count: async () => options.activeWarehouseCount,
      update: async (args: Record<string, unknown>) => {
        updates.push(args);
        return { id: "warehouse-a", isActive: false };
      },
    },
    recipe: { count: async () => options.recipeVariantCount },
  };
  const service = new InventoryService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    warehouse: {
      findFirst: async () => ({ id: "warehouse-a", branchId: "branch-a" }),
    },
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  } as never);
  return { service, audits, updates };
}

test("the last active warehouse cannot be archived while recipes need stock", async () => {
  const { service, audits, updates } = makeWarehouseService({
    activeWarehouseCount: 1,
    recipeVariantCount: 2,
  });

  await assert.rejects(
    service.archiveWarehouse("warehouse-a", owner),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.equal(updates.length, 0);
  assert.equal(audits.length, 0);
});

test("a last warehouse without recipe-backed products can be archived with tenant audit scope", async () => {
  const { service, audits, updates } = makeWarehouseService({
    activeWarehouseCount: 1,
    recipeVariantCount: 0,
  });

  await service.archiveWarehouse("warehouse-a", owner);

  assert.equal(updates.length, 1);
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.tenantId, "tenant-a");
});

test("a warehouse can be archived when another active warehouse supports recipes", async () => {
  const { service, audits, updates } = makeWarehouseService({
    activeWarehouseCount: 2,
    recipeVariantCount: 2,
  });

  await service.archiveWarehouse("warehouse-a", owner);

  assert.equal(updates.length, 1);
  assert.equal(audits[0]?.tenantId, "tenant-a");
});

test("ingredient change audit entries use the resolved tenant for a global owner", async () => {
  const audits: Array<Record<string, unknown>> = [];
  const ingredients = new Map([
    ["ingredient-update", { id: "ingredient-update", isActive: true }],
    [
      "ingredient-archive",
      { id: "ingredient-archive", isActive: true, _count: { recipeItems: 0 } },
    ],
  ]);
  const tx = {
    auditLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        audits.push(args.data);
        return args.data;
      },
    },
    ingredient: {
      update: async ({ where }: { where: { id: string } }) => ({ id: where.id }),
      deleteMany: async () => ({ count: 1 }),
    },
  };
  const service = new InventoryService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    ingredient: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        ingredients.get(where.id) ?? null,
      findMany: async () => [
        { id: "ingredient-delete", name: "Salt", _count: { recipeItems: 0, stock: 0, stockMovements: 0 } },
      ],
    },
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  } as never);

  await service.updateIngredient("ingredient-update", { name: "Updated" }, owner);
  await service.archiveIngredient("ingredient-archive", owner);
  await service.permanentlyDeleteIngredients(["ingredient-delete"], owner);

  assert.equal(audits.length, 3);
  assert.ok(audits.every((entry) => entry.tenantId === "tenant-a"));
});
