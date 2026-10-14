import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { HomepageService } from "../src/modules/homepage/homepage.service";
import { RecipesService } from "../src/modules/recipes/recipes.service";

function databaseWithActiveTenants(ids: string[]) {
  const writes = { recipes: 0, homepage: 0, transactions: 0 };
  const reads = { branches: 0 };
  const database = {
    restaurantTenant: {
      findMany: async () => ids.map((id) => ({ id })),
    },
    branch: {
      findFirst: async () => {
        reads.branches += 1;
        return null;
      },
    },
    recipe: {
      findMany: async () => {
        writes.recipes += 1;
        return [];
      },
    },
    homepageHeroSlide: {
      findMany: async () => {
        writes.homepage += 1;
        return [];
      },
      create: async () => {
        writes.homepage += 1;
        return {};
      },
    },
    promotion: {
      findMany: async () => {
        writes.homepage += 1;
        return [];
      },
      create: async () => {
        writes.homepage += 1;
        return {};
      },
    },
    $transaction: async () => {
      writes.transactions += 1;
      return {};
    },
  };
  return { database: database as never, writes, reads };
}

test("recipe routes fail closed before reads and writes with multiple active tenants", async () => {
  const { database, writes } = databaseWithActiveTenants([
    "tenant-a",
    "tenant-b",
  ]);
  const service = new RecipesService(database);

  await assert.rejects(service.listRecipes(), ForbiddenException);
  await assert.rejects(
    service.getRecipeByVariant("foreign-variant"),
    ForbiddenException,
  );
  await assert.rejects(
    service.upsertRecipe({ variantId: "foreign-variant", items: [] } as never),
    ForbiddenException,
  );

  assert.deepEqual(writes, { recipes: 0, homepage: 0, transactions: 0 });
});

test("recipe queries include the active tenant branch boundary", async () => {
  let listingWhere: unknown;
  let variantWhere: unknown;
  const service = new RecipesService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    recipe: {
      findMany: async (query: { where: unknown }) => {
        listingWhere = query.where;
        return [];
      },
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work({
        productVariant: {
          findFirst: async (query: { where: unknown }) => {
            variantWhere = query.where;
            return null;
          },
        },
      } as never),
  } as never);
  const tenantProduct = {
    OR: [{ branch: { tenantId: "tenant-a" } }, { branchId: null }],
  };

  await service.listRecipes();
  assert.deepEqual(listingWhere, {
    variant: { is: { product: { is: tenantProduct } } },
  });
  await assert.rejects(
    service.upsertRecipe({ variantId: "foreign-variant", items: [] } as never),
    NotFoundException,
  );
  assert.deepEqual(variantWhere, {
    id: "foreign-variant",
    product: { is: tenantProduct },
  });
});

test("homepage routes fail closed before reads and writes with multiple active tenants", async () => {
  const { database, writes } = databaseWithActiveTenants([
    "tenant-a",
    "tenant-b",
  ]);
  const service = new HomepageService(database);
  const operations = [
    () => service.getCustomerHome(),
    () => service.listHeroSlides(),
    () => service.createHeroSlide({} as never),
    () => service.updateHeroSlide("slide-id", {} as never),
    () => service.deleteHeroSlide("slide-id"),
    () => service.deleteHeroSlidesBulk(["slide-id"]),
    () => service.listPromotions(),
    () => service.createPromotion({} as never),
    () => service.updatePromotion("promotion-id", {} as never),
    () => service.deletePromotion("promotion-id"),
    () => service.deletePromotionsBulk(["promotion-id"]),
  ];

  for (const operation of operations) {
    await assert.rejects(operation(), ForbiddenException);
  }

  assert.deepEqual(writes, { recipes: 0, homepage: 0, transactions: 0 });
});

test("customer homepage rejects a branch outside the sole active tenant", async () => {
  const { database, writes, reads } = databaseWithActiveTenants(["tenant-a"]);
  const service = new HomepageService(database);

  await assert.rejects(
    service.getCustomerHome("branch-from-another-tenant"),
    NotFoundException,
  );
  assert.equal(reads.branches, 1);
  assert.equal(writes.homepage, 0);
});

test("bulk homepage deletes are tenant-scoped", async () => {
  let heroCountWhere: unknown;
  let promotionCountWhere: unknown;
  let heroDeleteCalled = false;
  let promotionDeleteCalled = false;
  const service = new HomepageService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    homepageHeroSlide: {
      count: async (query: { where: unknown }) => {
        heroCountWhere = query.where;
        return 0;
      },
      deleteMany: async () => {
        heroDeleteCalled = true;
      },
    },
    promotion: {
      count: async (query: { where: unknown }) => {
        promotionCountWhere = query.where;
        return 0;
      },
      deleteMany: async () => {
        promotionDeleteCalled = true;
      },
    },
  } as never);

  await assert.rejects(
    service.deleteHeroSlidesBulk(["foreign-slide"]),
    NotFoundException,
  );
  await assert.rejects(
    service.deletePromotionsBulk(["foreign-promotion"]),
    NotFoundException,
  );

  const productScope = {
    OR: [{ branch: { tenantId: "tenant-a" } }, { branchId: null }],
  };
  assert.deepEqual(heroCountWhere, {
    AND: [
      { id: { in: ["foreign-slide"] } },
      {
        OR: [{ productId: null }, { product: { is: productScope } }],
      },
    ],
  });
  assert.deepEqual(promotionCountWhere, {
    AND: [
      { id: { in: ["foreign-promotion"] } },
      {
        AND: [
          {
            OR: [{ productId: null }, { product: { is: productScope } }],
          },
          {
            OR: [
              { categoryId: null },
              {
                category: {
                  is: {
                    OR: [
                      { branch: { tenantId: "tenant-a" } },
                      { branchId: null },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(heroDeleteCalled, false);
  assert.equal(promotionDeleteCalled, false);
});

test("homepage writes reject foreign product and category references", async () => {
  let productWhere: unknown;
  let categoryWhere: unknown;
  let writes = 0;
  const service = new HomepageService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    product: {
      findFirst: async (query: { where: unknown }) => {
        productWhere = query.where;
        return null;
      },
    },
    category: {
      findFirst: async (query: { where: unknown }) => {
        categoryWhere = query.where;
        return null;
      },
    },
    homepageHeroSlide: {
      create: async () => {
        writes += 1;
      },
    },
    promotion: {
      create: async () => {
        writes += 1;
      },
    },
  } as never);

  await assert.rejects(
    service.createHeroSlide({ productId: "foreign-product" } as never),
    NotFoundException,
  );
  await assert.rejects(
    service.createPromotion({ categoryId: "foreign-category" } as never),
    NotFoundException,
  );

  const productScope = {
    OR: [{ branch: { tenantId: "tenant-a" } }, { branchId: null }],
  };
  assert.deepEqual(productWhere, {
    id: "foreign-product",
    AND: [productScope],
  });
  assert.deepEqual(categoryWhere, {
    id: "foreign-category",
    AND: [productScope],
  });
  assert.equal(writes, 0);
});
