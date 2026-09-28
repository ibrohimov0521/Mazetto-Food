import assert from "node:assert/strict";
import test from "node:test";
import { CustomersService } from "../src/modules/customers/customers.service";

function createService() {
  let productDetailWhere: Record<string, unknown> | undefined;
  let productListWhere: Record<string, unknown> | undefined;
  let categoryWhere: Record<string, unknown> | undefined;
  const availabilityScopeCalls: Array<string | undefined> = [];
  const tenantScopeCalls: Array<string | undefined> = [];
  const service = Object.create(CustomersService.prototype) as CustomersService;
  Object.assign(service, {
    prisma: {
      product: {
        findFirst: async (args: { where: Record<string, unknown> }) => {
          productDetailWhere = args.where;
          return { id: "product-1", variants: [], modifiers: [] };
        },
        findMany: async (args: { where: Record<string, unknown> }) => {
          productListWhere = args.where;
          return [];
        },
      },
      category: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          categoryWhere = args.where;
          return [];
        },
      },
    },
    branchesService: {
      resolveCustomerTenantId: async (
        branchId: string | undefined,
        tenantId: string,
      ) => {
        assert.equal(tenantId, "tenant-a");
        tenantScopeCalls.push(branchId);
        return tenantId;
      },
      getUnavailableProductWhere: (branchId?: string) => {
        availabilityScopeCalls.push(branchId);
        return branchId
          ? {
              NOT: {
                branchAvailabilities: {
                  some: {
                    branchId,
                    status: { in: ["OUT_OF_STOCK", "UNAVAILABLE"] },
                  },
                },
              },
            }
          : {};
      },
    },
  });
  return {
    service,
    getProductDetailWhere: () => productDetailWhere,
    getProductListWhere: () => productListWhere,
    getCategoryWhere: () => categoryWhere,
    availabilityScopeCalls,
    tenantScopeCalls,
  };
}

test("customer product detail respects the selected branch and its availability", async () => {
  const { service, getProductDetailWhere, availabilityScopeCalls, tenantScopeCalls } =
    createService();

  await service.getProduct("product-1", "branch-1", "tenant-a");

  assert.deepEqual(getProductDetailWhere()?.OR, [
    { branchId: "branch-1" },
    { branchId: null },
  ]);
  assert.deepEqual(getProductDetailWhere()?.category, {
    OR: [{ branchId: "branch-1" }, { branchId: null }],
  });
  assert.deepEqual(tenantScopeCalls, ["branch-1"]);
  assert.equal(availabilityScopeCalls[0], "branch-1");
  assert.deepEqual(getProductDetailWhere()?.NOT, {
    branchAvailabilities: {
      some: {
        branchId: "branch-1",
        status: { in: ["OUT_OF_STOCK", "UNAVAILABLE"] },
      },
    },
  });
});

test("customer product detail without a branch stays within the sole tenant", async () => {
  const { service, getProductDetailWhere, tenantScopeCalls } = createService();

  await service.getProduct("product-1", undefined, "tenant-a");

  const tenantBranchScope = {
    OR: [{ branchId: null }, { branch: { tenantId: "tenant-a" } }],
  };
  assert.deepEqual(getProductDetailWhere()?.OR, tenantBranchScope.OR);
  assert.deepEqual(getProductDetailWhere()?.category, tenantBranchScope);
  assert.deepEqual(tenantScopeCalls, [undefined]);
  assert.equal(getProductDetailWhere()?.NOT, undefined);
});
test("customer category listing scopes branchless requests to the sole tenant", async () => {
  const { service, getCategoryWhere } = createService();

  await service.listCategories(undefined, "tenant-a");

  assert.deepEqual(getCategoryWhere()?.OR, [
    { branchId: null },
    { branch: { tenantId: "tenant-a" } },
  ]);
});

test("customer product listing scopes products and categories to the sole tenant", async () => {
  const { service, getProductListWhere } = createService();

  await service.listProducts(undefined, undefined, "tenant-a");

  const expectedScope = {
    OR: [{ branchId: null }, { branch: { tenantId: "tenant-a" } }],
  };
  assert.deepEqual(getProductListWhere()?.OR, expectedScope.OR);
  assert.deepEqual(getProductListWhere()?.category, expectedScope);
});
