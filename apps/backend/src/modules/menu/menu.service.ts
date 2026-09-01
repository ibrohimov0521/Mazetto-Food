import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  customerVisibleProductCodeSet,
  legacyProductCodeSet,
} from "../customers/customer-catalog-visibility";
import type { ListMenuDto } from "./dto/list-menu.dto";
import type {
  CreateCategoryDto,
  CreateModifierDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from "./dto/menu-management.dto";

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(query: ListMenuDto) {
    return this.prisma.category.findMany({
      where: {
        ...(query.includeInactive === "true" ? {} : { isActive: true }),
        ...(query.branchId ? { OR: [{ branchId: query.branchId }, { branchId: null }] } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        branchId: true,
        parentId: true,
        code: true,
        name: true,
        description: true,
        imageUrl: true,
        isActive: true,
        sortOrder: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async listProducts(query: ListMenuDto) {
    const products = await this.prisma.product.findMany({
      where: {
        ...(query.includeInactive === "true" ? {} : { isAvailable: true }),
        ...(query.branchId ? { OR: [{ branchId: query.branchId }, { branchId: null }] } : {}),
        ...this.unavailableProductWhere(query.branchId),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.recommended === "true" ? { isRecommended: true } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        branchId: true,
        categoryId: true,
        code: true,
        name: true,
        description: true,
        imageUrl: true,
        preparationTime: true,
        sellingPrice: true,
        isAvailable: true,
        isRecommended: true,
        isCombo: true,
        sortOrder: true,
        printerRouting: true,
        category: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        variants: {
          where: query.includeInactive === "true" ? {} : { isAvailable: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            code: true,
            name: true,
            sellingPrice: true,
            isDefault: true,
            isAvailable: true,
            sortOrder: true,
          },
        },
        bundleItems: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            componentCode: true,
            componentName: true,
            quantity: true,
            unitLabel: true,
            sortOrder: true,
            componentProduct: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        modifiers: {
          orderBy: { sortOrder: "asc" },
          select: {
            isRequired: true,
            minSelect: true,
            maxSelect: true,
            sortOrder: true,
            modifier: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                price: true,
                sortOrder: true,
              },
            },
          },
          where: {
            modifier: { isActive: true },
          },
        },
      },
    });

    return products.map((product) => ({
      ...product,
      catalogVisibility: this.getCatalogVisibility(product.code),
    }));
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        branchId: true,
        categoryId: true,
        code: true,
        name: true,
        description: true,
        imageUrl: true,
        preparationTime: true,
        sellingPrice: true,
        costPrice: true,
        isAvailable: true,
        isRecommended: true,
        isCombo: true,
        sortOrder: true,
        printerRouting: true,
        category: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        variants: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            code: true,
            name: true,
            sellingPrice: true,
            costPrice: true,
            isDefault: true,
            isAvailable: true,
            sortOrder: true,
          },
        },
        modifiers: {
          orderBy: { sortOrder: "asc" },
          select: {
            isRequired: true,
            minSelect: true,
            maxSelect: true,
            sortOrder: true,
            modifier: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                price: true,
                isActive: true,
                sortOrder: true,
              },
            },
          },
        },
        bundleItems: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            componentCode: true,
            componentName: true,
            quantity: true,
            unitLabel: true,
            sortOrder: true,
            componentProduct: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return {
      ...product,
      catalogVisibility: this.getCatalogVisibility(product.code),
    };
  }

  private getCatalogVisibility(code: string): "CANONICAL" | "LEGACY" | "INTERNAL" {
    if (customerVisibleProductCodeSet.has(code)) {
      return "CANONICAL";
    }

    if (legacyProductCodeSet.has(code)) {
      return "LEGACY";
    }

    return "INTERNAL";
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        branchId: dto.branchId ?? null,
        code: this.createCode(dto.name),
        name: dto.name,
        description: dto.description ?? null,
        imageUrl: dto.image ?? null,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    await this.assertCategory(id);

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.image !== undefined ? { imageUrl: dto.image } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteCategory(id: string) {
    await this.assertCategory(id);

    return this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async createProduct(dto: CreateProductDto) {
    const defaultVariant = dto.variants?.find((variant) => variant.isDefault) ?? dto.variants?.[0];
    const sellingPrice = new Prisma.Decimal(defaultVariant?.price ?? 0);

    const product = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          branchId: dto.branchId ?? null,
          categoryId: dto.categoryId,
          code: this.createCode(dto.name),
          name: dto.name,
          description: dto.description ?? null,
          imageUrl: dto.image ?? null,
          preparationTime: dto.preparationTime ?? null,
          sellingPrice,
          costPrice: defaultVariant?.costPrice ? new Prisma.Decimal(defaultVariant.costPrice) : null,
          isAvailable: true,
          isRecommended: dto.isRecommended ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });

      if (dto.variants?.length) {
        await tx.productVariant.createMany({
          data: dto.variants.map((variant, index) => ({
            productId: product.id,
            code: this.createCode(variant.name),
            name: variant.name,
            sellingPrice: new Prisma.Decimal(variant.price),
            costPrice:
              variant.costPrice !== undefined ? new Prisma.Decimal(variant.costPrice) : null,
            isDefault: variant.isDefault || index === 0,
            isAvailable: true,
            sortOrder: index,
          })),
        });
      }

      if (dto.modifiers?.length) {
        await tx.productModifier.createMany({
          data: dto.modifiers.map((modifier, index) => ({
            productId: product.id,
            modifierId: modifier.modifierId,
            sortOrder: index,
          })),
          skipDuplicates: true,
        });
      }

      return product;
    });

    return this.getProduct(product.id);
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    await this.assertProduct(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.image !== undefined ? { imageUrl: dto.image } : {}),
          ...(dto.isActive !== undefined ? { isAvailable: dto.isActive } : {}),
          ...(dto.isRecommended !== undefined ? { isRecommended: dto.isRecommended } : {}),
          ...(dto.preparationTime !== undefined ? { preparationTime: dto.preparationTime } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });

      if (dto.variants) {
        const defaultVariant = dto.variants.find((variant) => variant.isDefault) ?? dto.variants[0];

        await tx.productVariant.updateMany({
          where: { productId: id },
          data: { isAvailable: false },
        });

        for (const [index, variant] of dto.variants.entries()) {
          if (variant.id) {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                name: variant.name,
                sellingPrice: new Prisma.Decimal(variant.price),
                costPrice:
                  variant.costPrice !== undefined ? new Prisma.Decimal(variant.costPrice) : null,
                isDefault: variant.isDefault,
                isAvailable: true,
                sortOrder: index,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                code: this.createCode(variant.name),
                name: variant.name,
                sellingPrice: new Prisma.Decimal(variant.price),
                costPrice:
                  variant.costPrice !== undefined ? new Prisma.Decimal(variant.costPrice) : null,
                isDefault: variant.isDefault,
                sortOrder: index,
              },
            });
          }
        }

        if (defaultVariant) {
          await tx.product.update({
            where: { id },
            data: {
              sellingPrice: new Prisma.Decimal(defaultVariant.price),
              costPrice:
                defaultVariant.costPrice !== undefined
                  ? new Prisma.Decimal(defaultVariant.costPrice)
                  : null,
            },
          });
        }
      }

      if (dto.modifiers) {
        await tx.productModifier.deleteMany({ where: { productId: id } });
        await tx.productModifier.createMany({
          data: dto.modifiers.map((modifier, index) => ({
            productId: id,
            modifierId: modifier.modifierId,
            sortOrder: index,
          })),
          skipDuplicates: true,
        });
      }

    });

    return this.getProduct(id);
  }

  async deleteProduct(id: string) {
    await this.assertProduct(id);

    return this.prisma.product.update({
      where: { id },
      data: { isAvailable: false },
    });
  }

  async createModifier(dto: CreateModifierDto) {
    return this.prisma.modifier.create({
      data: {
        code: this.createCode(dto.name),
        name: dto.name,
        price: new Prisma.Decimal(dto.price),
      },
    });
  }

  private async assertCategory(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });

    if (!category) {
      throw new NotFoundException("Category not found");
    }
  }

  private async assertProduct(id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });

    if (!product) {
      throw new NotFoundException("Product not found");
    }
  }

  private createCode(value: string): string {
    const slug = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return `${slug || "ITEM"}_${Date.now().toString(36).toUpperCase()}`;
  }

  private unavailableProductWhere(branchId?: string): Prisma.ProductWhereInput {
    if (!branchId) {
      return {};
    }

    return {
      NOT: {
        branchAvailabilities: {
          some: {
            branchId,
            status: { in: ["OUT_OF_STOCK", "UNAVAILABLE"] },
          },
        },
      },
    };
  }
}
