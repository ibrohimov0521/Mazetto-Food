import { Prisma, PrismaClient, ProductPrinterRouting } from "@prisma/client";
import { menuCategories } from "./categories";
import { menuCombos } from "./combos";
import { menuModifiers } from "./modifiers";
import { menuProducts, type MenuProductSeed } from "./products";
import { comboVariants } from "./combos";
import { menuVariants, type MenuVariantSeed } from "./variants";

type SeedResult = {
  categories: number;
  products: number;
  variants: number;
  modifiers: number;
  combos: number;
};

export async function seedMenu(prisma: PrismaClient): Promise<SeedResult> {
  const categoryByCode = new Map<string, string>();
  const modifierByCode = new Map<string, string>();
  const productByCode = new Map<string, { id: string; basePrice: number }>();
  const allProducts = [...menuProducts, ...menuCombos];
  const allVariants = [...menuVariants, ...comboVariants];

  for (const category of menuCategories) {
    const row = await upsertGlobalCategory(prisma, {
      code: category.code,
      name: category.name,
      description: category.description,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      isActive: true,
    });
    categoryByCode.set(category.code, row.id);
  }

  for (const modifier of menuModifiers) {
    const row = await prisma.modifier.upsert({
      where: { code: modifier.code },
      update: {
        name: modifier.name,
        description: modifier.description,
        price: new Prisma.Decimal(modifier.price),
        sortOrder: modifier.sortOrder,
        isActive: true,
      },
      create: {
        code: modifier.code,
        name: modifier.name,
        description: modifier.description,
        price: new Prisma.Decimal(modifier.price),
        sortOrder: modifier.sortOrder,
        isActive: true,
      },
    });
    modifierByCode.set(modifier.code, row.id);
  }

  for (const [index, product] of allProducts.entries()) {
    const categoryId = categoryByCode.get(product.categoryCode);

    if (!categoryId) {
      throw new Error(`Category ${product.categoryCode} was not seeded`);
    }

    const row = await upsertGlobalProduct(prisma, product, categoryId, index);
    productByCode.set(product.code, { id: row.id, basePrice: product.basePrice });
  }

  for (const variant of allVariants) {
    const product = productByCode.get(variant.productCode);

    if (!product) {
      throw new Error(`Product ${variant.productCode} was not seeded`);
    }

    await upsertVariant(prisma, variant, product.id, variant.price || product.basePrice);
  }

  for (const product of allProducts) {
    const row = productByCode.get(product.code);

    if (!row) {
      throw new Error(`Product ${product.code} was not seeded`);
    }

    await prisma.productModifier.deleteMany({ where: { productId: row.id } });

    for (const [index, modifierCode] of (product.modifierCodes ?? []).entries()) {
      const modifierId = modifierByCode.get(modifierCode);

      if (!modifierId) {
        throw new Error(`Modifier ${modifierCode} was not seeded`);
      }

      await prisma.productModifier.create({
        data: {
          productId: row.id,
          modifierId,
          sortOrder: index,
        },
      });
    }
  }

  for (const combo of menuCombos) {
    const bundleProduct = productByCode.get(combo.code);

    if (!bundleProduct) {
      throw new Error(`Combo ${combo.code} was not seeded`);
    }

    await prisma.productBundleItem.deleteMany({
      where: { bundleProductId: bundleProduct.id },
    });

    for (const component of combo.bundle) {
      const componentProduct = component.productCode
        ? productByCode.get(component.productCode)
        : null;

      if (component.productCode && !componentProduct) {
        throw new Error(`Bundle component product ${component.productCode} was not seeded`);
      }

      await prisma.productBundleItem.create({
        data: {
          bundleProductId: bundleProduct.id,
          componentCode: component.componentCode,
          componentName: component.componentName,
          componentProductId: componentProduct?.id ?? null,
          quantity: new Prisma.Decimal(component.quantity),
          unitLabel: component.unitLabel ?? null,
          sortOrder: component.sortOrder,
        },
      });
    }
  }

  return {
    categories: menuCategories.length,
    products: allProducts.length,
    variants: allVariants.length,
    modifiers: menuModifiers.length,
    combos: menuCombos.length,
  };
}

async function upsertGlobalCategory(
  prisma: PrismaClient,
  data: {
    code: string;
    name: string;
    description: string;
    imageUrl: string;
    sortOrder: number;
    isActive: boolean;
  },
) {
  const existing = await prisma.category.findFirst({
    where: { branchId: null, code: data.code },
    select: { id: true },
  });

  if (existing) {
    return prisma.category.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.category.create({
    data: {
      ...data,
      branchId: null,
    },
  });
}

async function upsertGlobalProduct(
  prisma: PrismaClient,
  product: MenuProductSeed,
  categoryId: string,
  sortOrder: number,
) {
  const existing = await prisma.product.findFirst({
    where: { branchId: null, code: product.code },
    select: { id: true },
  });
  const data = {
    categoryId,
    code: product.code,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    preparationTime: product.preparationTime,
    sellingPrice: new Prisma.Decimal(product.basePrice),
    isAvailable: product.active,
    isRecommended: product.recommended ?? false,
    isCombo: menuCombos.some((combo) => combo.code === product.code),
    sortOrder,
    printerRouting: ProductPrinterRouting.KITCHEN,
  };

  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.product.create({
    data: {
      ...data,
      branchId: null,
    },
  });
}

async function upsertVariant(
  prisma: PrismaClient,
  variant: MenuVariantSeed,
  productId: string,
  resolvedPrice: number,
) {
  const existing = await prisma.productVariant.findFirst({
    where: { productId, code: variant.code },
    select: { id: true },
  });
  const data = {
    code: variant.code,
    name: variant.name,
    sellingPrice: new Prisma.Decimal(resolvedPrice),
    costPrice: variant.costPrice !== undefined ? new Prisma.Decimal(variant.costPrice) : null,
    isDefault: variant.isDefault ?? false,
    isAvailable: true,
    sortOrder: variant.sortOrder,
  };

  if (existing) {
    return prisma.productVariant.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.productVariant.create({
    data: {
      ...data,
      productId,
    },
  });
}
