import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, StockMovementType } from "@prisma/client";
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
    $transaction: async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
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
      update: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
      }),
      create: async () => ({ id: "ingredient-create" }),
      deleteMany: async () => ({ count: 1 }),
    },
    warehouse: {
      create: async () => ({ id: "warehouse-create" }),
    },
  };
  const service = new InventoryService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    branch: { findFirst: async () => ({ id: "branch-a" }) },
    ingredient: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        ingredients.get(where.id) ?? null,
      findMany: async () => [
        {
          id: "ingredient-delete",
          name: "Salt",
          _count: { recipeItems: 0, stock: 0, stockMovements: 0 },
        },
      ],
    },
    $transaction: async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
  } as never);

  await service.updateIngredient(
    "ingredient-update",
    { name: "Updated" },
    owner,
  );
  await service.archiveIngredient("ingredient-archive", owner);
  await service.permanentlyDeleteIngredients(["ingredient-delete"], owner);
  await service.createIngredient(
    {
      name: "New ingredient",
      unit: "KG",
      minimumStock: 0,
      costPerUnit: 2,
    } as never,
    owner,
  );
  await service.createWarehouse({ branchId: "branch-a", name: "Main" }, owner);

  assert.equal(audits.length, 5);
  assert.ok(audits.every((entry) => entry.tenantId === "tenant-a"));
  assert.deepEqual(
    audits.slice(3).map(({ action, userId, entityId, metadata }) => ({
      action,
      userId,
      entityId,
      metadata,
    })),
    [
      {
        action: "INGREDIENT_CREATED",
        userId: "owner-a",
        entityId: "ingredient-create",
        metadata: undefined,
      },
      {
        action: "WAREHOUSE_CREATED",
        userId: "owner-a",
        entityId: "warehouse-create",
        metadata: { branchId: "branch-a" },
      },
    ],
  );
});

test("parallel replay of a source stock movement changes stock exactly once", async () => {
  let initialLookups = 0;
  let movementExists = false;
  let stockWrites = 0;
  let stockQuantity = new Prisma.Decimal(0);
  let releaseInitialLookups!: () => void;
  const initialLookupsFinished = new Promise<void>((resolve) => {
    releaseInitialLookups = resolve;
  });
  const movement = { id: "movement-order-item-a" };
  const tx = {
    stockMovement: {
      findFirst: async () => {
        if (initialLookups < 2) {
          initialLookups += 1;
          if (initialLookups === 2) releaseInitialLookups();
          await initialLookupsFinished;
          return null;
        }
        return movementExists ? movement : null;
      },
      createMany: async (args: { skipDuplicates?: boolean }) => {
        assert.equal(args.skipDuplicates, true);
        if (movementExists) return { count: 0 };
        movementExists = true;
        return { count: 1 };
      },
    },
    stock: {
      upsert: async (args: {
        update: { quantity: { increment: Prisma.Decimal } };
      }) => {
        stockWrites += 1;
        stockQuantity = stockQuantity.add(args.update.quantity.increment);
        return { quantity: stockQuantity };
      },
    },
  };
  const service = new InventoryService({} as never);
  const input = {
    ingredientId: "ingredient-a",
    warehouseId: "warehouse-a",
    type: StockMovementType.IN,
    quantity: new Prisma.Decimal(3),
    reason: null,
    sourceType: "ORDER_ITEM",
    sourceItemId: "order-item-a",
  };

  const results = await Promise.all([
    service.applyStockMovement(tx as never, input),
    service.applyStockMovement(tx as never, input),
  ]);

  assert.equal(results[0]?.id, movement.id);
  assert.equal(results[1]?.id, movement.id);
  assert.equal(stockWrites, 1);
  assert.equal(stockQuantity.toFixed(0), "3");
});
