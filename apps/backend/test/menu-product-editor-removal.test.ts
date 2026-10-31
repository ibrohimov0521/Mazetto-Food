import assert from "node:assert/strict";
import test from "node:test";
import { MenuService } from "../src/modules/menu/menu.service";

test("product edit archives omitted variants and persists an empty modifier list", async () => {
  const calls: Record<string, unknown> = {};
  const tx = {
    product: {
      update: async (args: unknown) => {
        calls.productUpdate = args;
        return {};
      },
    },
    productVariant: {
      updateMany: async (args: unknown) => {
        calls.variantArchive = args;
        return { count: 2 };
      },
      findFirst: async () => ({ id: "variant-keep" }),
      update: async (args: unknown) => {
        calls.variantUpdate = args;
        return {};
      },
      create: async () => ({}),
    },
    productModifier: {
      findMany: async () => [
        {
          modifierId: "modifier-removed",
          isRequired: false,
          minSelect: 0,
          maxSelect: null,
          sortOrder: 0,
        },
      ],
      deleteMany: async (args: unknown) => {
        calls.modifierDelete = args;
        return { count: 1 };
      },
      createMany: async (args: unknown) => {
        calls.modifierCreate = args;
        return { count: 0 };
      },
    },
    productBundleItem: { deleteMany: async () => ({ count: 0 }) },
  };
  const prisma = {
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    product: {
      findUnique: async () => ({
        id: "product-a",
        isCombo: false,
        _count: { bundleItems: 0 },
      }),
    },
    $transaction: async (
      callback: (transaction: typeof tx) => Promise<unknown>,
    ) => callback(tx),
  };
  const service = new MenuService(prisma as never);
  service.getProduct = async () => ({ id: "product-a" }) as never;

  await service.updateProduct("product-a", {
    variants: [
      { id: "variant-keep", name: "Kichik", price: 12000, isDefault: true },
    ],
    modifiers: [],
  });

  assert.deepEqual(calls.variantArchive, {
    where: { productId: "product-a" },
    data: { isAvailable: false },
  });
  assert.deepEqual(calls.modifierDelete, { where: { productId: "product-a" } });
  assert.deepEqual(calls.modifierCreate, { data: [], skipDuplicates: true });
});

test("editor product details return active variants only", async () => {
  let lookup: Record<string, unknown> | undefined;
  const service = new MenuService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    product: {
      findUnique: async (args: Record<string, unknown>) => {
        lookup = args;
        return { id: "product-a", code: "P-1" };
      },
    },
  } as never);

  await service.getProduct("product-a");

  const select = lookup?.select as { variants: { where: unknown } };
  assert.deepEqual(select.variants.where, { isAvailable: true });
});
