import assert from "node:assert/strict";
import test from "node:test";
import { InventoryService } from "../src/modules/inventory/inventory.service";

const owner = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
} as const;

function makeReadinessService(options: {
  activeWarehouses: number;
  recipeVariants: number;
  inactiveIngredientReferences: number;
  branchExists?: boolean;
}) {
  const branchQueries: unknown[] = [];
  const prisma = {
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
    branch: {
      findFirst: async (query: unknown) => {
        branchQueries.push(query);
        return options.branchExists === false ? null : { id: "branch-a" };
      },
    },
    warehouse: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        assert.deepEqual(where, { branchId: "branch-a", isActive: true });
        return options.activeWarehouses;
      },
    },
    recipe: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        assert.deepEqual(where, {
          items: { some: {} },
          variant: { product: { OR: [{ branchId: "branch-a" }, { branchId: null }] } },
        });
        return options.recipeVariants;
      },
    },
    recipeItem: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        assert.deepEqual(where, {
          ingredient: { isActive: false },
          recipe: {
            variant: {
              product: { OR: [{ branchId: "branch-a" }, { branchId: null }] },
            },
          },
        });
        return options.inactiveIngredientReferences;
      },
    },
  };

  return {
    service: new InventoryService(prisma as never),
    branchQueries,
  };
}

test("recipe-backed products need an active warehouse and active recipe ingredients", async () => {
  const { service } = makeReadinessService({
    activeWarehouses: 0,
    recipeVariants: 2,
    inactiveIngredientReferences: 1,
  });

  const readiness = await service.getReadiness(owner as never, "branch-a");

  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.issues, [
    "ACTIVE_WAREHOUSE_REQUIRED",
    "INACTIVE_RECIPE_INGREDIENT",
  ]);
});

test("inventory readiness is clear when recipes have a warehouse and active ingredients", async () => {
  const { service } = makeReadinessService({
    activeWarehouses: 1,
    recipeVariants: 2,
    inactiveIngredientReferences: 0,
  });

  const readiness = await service.getReadiness(owner as never, "branch-a");

  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.issues, []);
});

test("a warehouse is not required when there are no recipe-backed products", async () => {
  const { service } = makeReadinessService({
    activeWarehouses: 0,
    recipeVariants: 0,
    inactiveIngredientReferences: 0,
  });

  const readiness = await service.getReadiness(owner as never, "branch-a");

  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.issues, []);
});

test("inventory readiness rejects a branch outside the resolved tenant", async () => {
  const { service, branchQueries } = makeReadinessService({
    activeWarehouses: 1,
    recipeVariants: 1,
    inactiveIngredientReferences: 0,
    branchExists: false,
  });

  await assert.rejects(
    service.getReadiness(owner as never, "foreign-branch"),
    /Branch not found/,
  );
  assert.equal(branchQueries.length, 1);
});
