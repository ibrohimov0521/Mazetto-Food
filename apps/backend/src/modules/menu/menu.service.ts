import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  customerVisibleProductCodeSet,
  isCustomerVisibleProductCode,
  legacyProductCodeSet,
} from "../customers/customer-catalog-visibility";
import type { ListMenuDto } from "./dto/list-menu.dto";
import type {
  CreateCategoryDto,
  CreateModifierDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateModifierDto,
  UpdateProductDto,
} from "./dto/menu-management.dto";

/*
 * Mahsulot-modifikator bog'lamining guruh sozlamalari.
 *
 * So'rovda maydon KO'RSATILMAGAN bo'lsa, eski qiymat qaytariladi.
 * Bu `deleteMany` + `createMany` naqshi uchun zarur: aks holda har
 * saqlash sozlamalarni standart qiymatga qaytarardi.
 *
 * Eski yozuv ham bo'lmasa (yangi bog'lam) — sxemadagi standart
 * qiymatlar: majburiy emas, kamida 0 ta tanlov.
 *
 * `maxSelect` sxemada `Int?` va `null` "yuqori chegara YO'Q" degani,
 * shuning uchun u ataylab `null` bilan saqlanadi: uni 1 ga aylantirish
 * cheksiz tanlovli guruhni jimgina bitta tanlovga qisib qo'yardi.
 */
export function productModifierSettings(
  modifier: {
    isRequired?: boolean;
    minSelect?: number;
    maxSelect?: number;
  },
  previous?: {
    isRequired: boolean;
    minSelect: number;
    maxSelect: number | null;
  },
) {
  const isRequired = modifier.isRequired ?? previous?.isRequired ?? false;
  const settings = {
    isRequired,
    minSelect:
      modifier.minSelect ?? previous?.minSelect ?? (isRequired ? 1 : 0),
    maxSelect: modifier.maxSelect ?? previous?.maxSelect ?? null,
  };

  if (settings.isRequired && settings.minSelect < 1) {
    throw new BadRequestException(
      "Majburiy qo'shimcha uchun eng kam tanlov kamida 1",
    );
  }
  if (
    settings.maxSelect !== null &&
    settings.minSelect > settings.maxSelect
  ) {
    throw new BadRequestException(
      "Eng ko'p tanlov eng kam tanlovdan kichik bo'la olmaydi",
    );
  }

  return settings;
}

export function assertUniqueProductModifiers(
  modifiers: Array<{ modifierId: string }> | undefined,
): void {
  if (!modifiers) return;
  const ids = new Set<string>();

  for (const modifier of modifiers) {
    if (ids.has(modifier.modifierId)) {
      throw new BadRequestException(
        "Bir qo'shimchani mahsulotga ikki marta biriktirib bo'lmaydi",
      );
    }
    ids.add(modifier.modifierId);
  }
}

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
            children: true,
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
        /*
         * Filial bo'yicha mavjudlik — admin mahsulot tahrirlash ekranida
         * qaysi filialda mahsulot yopilganini ko'rsatish uchun.
         * O'zgartirish `PATCH /branches/:id/product-availability` orqali.
         */
        branchAvailabilities: {
          select: {
            id: true,
            branchId: true,
            status: true,
            reason: true,
            updatedAt: true,
            branch: { select: { id: true, code: true, name: true } },
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

  private getCatalogVisibility(code: string): "CANONICAL" | "LEGACY" | "CUSTOM" | "INTERNAL" {
    if (customerVisibleProductCodeSet.has(code)) {
      return "CANONICAL";
    }

    if (legacyProductCodeSet.has(code)) {
      return "LEGACY";
    }

    return isCustomerVisibleProductCode(code) ? "CUSTOM" : "INTERNAL";
  }

  async createCategory(dto: CreateCategoryDto) {
    await this.assertValidCategoryParent(
      null,
      dto.parentId ?? null,
      dto.branchId ?? null,
    );

    return this.prisma.category.create({
      data: {
        branchId: dto.branchId ?? null,
        code: this.createCode(dto.name),
        name: dto.name,
        description: dto.description ?? null,
        imageUrl: dto.image ?? null,
        parentId: dto.parentId ?? null,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }
    if (dto.parentId !== undefined) {
      await this.assertValidCategoryParent(
        id,
        dto.parentId,
        category.branchId,
      );
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.image !== undefined ? { imageUrl: dto.image } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteCategory(id: string) {
    await this.assertCategory(id);
    const dependencies = await this.prisma.category.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            children: { where: { isActive: true } },
            products: { where: { isAvailable: true } },
          },
        },
      },
    });

    if (dependencies?._count.children) {
      throw new BadRequestException(
        "Avval quyi kategoriyalarni ko'chiring yoki arxivlang",
      );
    }
    if (dependencies?._count.products) {
      throw new BadRequestException(
        "Avval kategoriya mahsulotlarini ko'chiring yoki menyudan oling",
      );
    }

    return this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async permanentlyDeleteCategories(ids: string[]) {
    const uniqueIds = [...new Set((ids ?? []).filter((id) => typeof id === "string" && id.trim()))];
    if (!uniqueIds.length) {
      throw new BadRequestException("Kamida bitta kategoriya tanlanishi kerak");
    }

    const categories = await this.prisma.category.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        name: true,
        _count: { select: { products: true, children: true, promotions: true } },
      },
    });
    if (categories.length !== uniqueIds.length) {
      throw new NotFoundException("Tanlangan kategoriyalarning biri topilmadi");
    }

    const blocked = categories.filter(
      (category) =>
        category._count.products > 0 ||
        category._count.children > 0 ||
        category._count.promotions > 0,
    );
    if (blocked.length) {
      throw new BadRequestException(
        `Mahsulot, quyi kategoriya yoki aksiya bog'langan kategoriyalarni o'chirib bo'lmaydi: ${blocked.map((category) => category.name).join(", ")}`,
      );
    }

    await this.prisma.category.deleteMany({ where: { id: { in: uniqueIds } } });
    return { deleted: true, count: uniqueIds.length, ids: uniqueIds };
  }

  async createProduct(dto: CreateProductDto) {
    assertUniqueProductModifiers(dto.modifiers);
    const defaultVariant = dto.variants?.find((variant) => variant.isDefault) ?? dto.variants?.[0];
    const defaultVariantIndex = Math.max(
      dto.variants?.findIndex((variant) => variant === defaultVariant) ?? -1,
      0,
    );
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
            isDefault: index === defaultVariantIndex,
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
            ...productModifierSettings(modifier),
            sortOrder: modifier.sortOrder ?? index,
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
    assertUniqueProductModifiers(dto.modifiers);

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
        const defaultVariantIndex = Math.max(
          dto.variants.findIndex((variant) => variant === defaultVariant),
          0,
        );

        await tx.productVariant.updateMany({
          where: { productId: id },
          data: { isAvailable: false },
        });

        for (const [index, variant] of dto.variants.entries()) {
          if (variant.id) {
            const ownedVariant = await tx.productVariant.findFirst({
              where: { id: variant.id, productId: id },
              select: { id: true },
            });
            if (!ownedVariant) {
              throw new BadRequestException(
                "Variant bu mahsulotga tegishli emas",
              );
            }
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                name: variant.name,
                sellingPrice: new Prisma.Decimal(variant.price),
                costPrice:
                  variant.costPrice !== undefined ? new Prisma.Decimal(variant.costPrice) : null,
                isDefault: index === defaultVariantIndex,
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
                isDefault: index === defaultVariantIndex,
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
        /*
         * MAVJUD SOZLAMALAR SAQLANADI.
         *
         * Bu blok `deleteMany` + `createMany` qiladi, ya'ni har saqlashda
         * bog'lamlar qaytadan yaratiladi. Ilgari faqat `modifierId` va
         * indeks yozilardi — natijada mahsulot har saqlanganda
         * `isRequired`, `minSelect`, `maxSelect` standart qiymatga
         * tushib ketardi va admin buni sezmasdi ham.
         *
         * Endi eski qiymatlar OLDIN o'qiladi va so'rovda aniq
         * ko'rsatilmagan maydonlar o'sha joyidan tiklanadi.
         */
        const previous = await tx.productModifier.findMany({
          where: { productId: id },
          select: {
            modifierId: true,
            isRequired: true,
            minSelect: true,
            maxSelect: true,
            sortOrder: true,
          },
        });
        const previousByModifier = new Map(
          previous.map((link) => [link.modifierId, link]),
        );

        await tx.productModifier.deleteMany({ where: { productId: id } });
        await tx.productModifier.createMany({
          data: dto.modifiers.map((modifier, index) => {
            const before = previousByModifier.get(modifier.modifierId);

            return {
              productId: id,
              modifierId: modifier.modifierId,
              ...productModifierSettings(modifier, before),
              sortOrder: modifier.sortOrder ?? before?.sortOrder ?? index,
            };
          }),
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

  async permanentlyDeleteProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        _count: {
          select: {
            cartItems: true,
            orderItems: true,
            favorites: true,
            usedInBundles: true,
            bundleItems: true,
            heroSlides: true,
            promotions: true,
            variants: { where: { recipe: { isNot: null } } },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    if (this.getCatalogVisibility(product.code) !== "CUSTOM") {
      throw new BadRequestException(
        "Faqat admin qo'shgan yangi mahsulotlarni butunlay o'chirish mumkin",
      );
    }

    const blockers = [
      product._count.orderItems ? "buyurtma tarixi" : null,
      product._count.cartItems ? "mijoz savati" : null,
      product._count.favorites ? "mijoz sevimlilari" : null,
      product._count.usedInBundles ? "set tarkibi" : null,
      product._count.bundleItems ? "set mahsuloti" : null,
      product._count.heroSlides ? "bosh sahifa slaydi" : null,
      product._count.promotions ? "aksiya/reklama" : null,
      product._count.variants ? "retsept" : null,
    ].filter(Boolean);

    if (blockers.length) {
      throw new BadRequestException(
        `Mahsulotni butunlay o'chirib bo'lmaydi: ${blockers.join(", ")} bog'langan. Uni arxivga oling.`,
      );
    }

    await this.prisma.product.delete({ where: { id } });

    return { deleted: true, id };
  }

  async permanentlyDeleteProducts(ids: string[]) {
    const uniqueIds = [...new Set((ids ?? []).filter((id) => typeof id === "string" && id.trim()))];
    if (!uniqueIds.length) {
      throw new BadRequestException("Kamida bitta mahsulot tanlanishi kerak");
    }
    const deleted: string[] = [];
    for (const id of uniqueIds) {
      await this.permanentlyDeleteProduct(id);
      deleted.push(id);
    }
    return { deleted: true, count: deleted.length, ids: deleted };
  }

  /**
   * Modifier katalogi.
   *
   * Ilgari faqat YARATISH endpoint'i bor edi, ro'yxat yo'q edi — shuning uchun
   * mahsulot tahrirlashda modifier tanlash imkoniyati qurib bo'lmasdi.
   */
  listModifiers(includeInactive = false) {
    return this.prisma.modifier.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: true } },
      },
    });
  }

  async updateModifier(id: string, dto: UpdateModifierDto) {
    await this.assertModifier(id);

    return this.prisma.modifier.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.price === undefined ? {} : { price: new Prisma.Decimal(dto.price) }),
        ...(dto.description === undefined
          ? {}
          : { description: dto.description }),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
        ...(dto.sortOrder === undefined ? {} : { sortOrder: dto.sortOrder }),
      },
    });
  }

  private async assertModifier(id: string): Promise<void> {
    const modifier = await this.prisma.modifier.findUnique({ where: { id }, select: { id: true } });

    if (!modifier) {
      throw new NotFoundException("Modifier not found");
    }
  }

  async createModifier(dto: CreateModifierDto) {
    return this.prisma.modifier.create({
      data: {
        code: this.createCode(dto.name),
        name: dto.name,
        price: new Prisma.Decimal(dto.price),
        /*
         * Ilgari faqat nom va narx yozilardi, ya'ni admin panel har
         * yangi modifikatordan keyin ikkinchi PATCH yuborishga majbur
         * bo'lardi va shu ikki so'rov orasida modifikator noto'g'ri
         * tartibda ko'rinardi.
         */
        ...(dto.description === undefined
          ? {}
          : { description: dto.description }),
        ...(dto.sortOrder === undefined ? {} : { sortOrder: dto.sortOrder }),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      },
    });
  }

  private async assertCategory(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });

    if (!category) {
      throw new NotFoundException("Category not found");
    }
  }

  private async assertValidCategoryParent(
    categoryId: string | null,
    parentId: string | null,
    branchId: string | null,
  ): Promise<void> {
    if (!parentId) {
      return;
    }
    if (parentId === categoryId) {
      throw new BadRequestException("Kategoriya o'ziga ota bo'la olmaydi");
    }

    let parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true, branchId: true },
    });

    if (!parent) {
      throw new BadRequestException("Ota kategoriya topilmadi");
    }
    if (parent.branchId !== null && parent.branchId !== branchId) {
      throw new BadRequestException(
        "Ota kategoriya boshqa filialga tegishli",
      );
    }

    const visited = new Set<string>();
    while (parent) {
      if (parent.id === categoryId || visited.has(parent.id)) {
        throw new BadRequestException(
          "Kategoriya daraxtida aylana hosil qilib bo'lmaydi",
        );
      }
      visited.add(parent.id);
      if (!parent.parentId) {
        return;
      }
      parent = await this.prisma.category.findUnique({
        where: { id: parent.parentId },
        select: { id: true, parentId: true, branchId: true },
      });
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
