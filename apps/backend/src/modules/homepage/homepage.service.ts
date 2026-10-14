import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveSoleActiveTenantId } from "../../common/auth/tenant-scope";
import { customerVisibleProductWhere } from "../customers/customer-catalog-visibility";
import type {
  HomepageHeroSlideDto,
  PromotionDto,
  UpdateHomepageHeroSlideDto,
  UpdatePromotionDto,
} from "./dto/homepage.dto";

@Injectable()
export class HomepageService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomerHome(branchId?: string) {
    const tenantId = await resolveSoleActiveTenantId(this.prisma);
    await this.assertBranchBelongsToTenant(branchId, tenantId);
    const [configuredHeroSlides, promotions] = await Promise.all([
      this.listActiveHeroSlides(tenantId),
      this.listActivePromotions(tenantId),
    ]);

    return {
      heroSlides: configuredHeroSlides.length
        ? configuredHeroSlides
        : await this.createProductHeroFallback(branchId, tenantId),
      promotions,
    };
  }

  async listHeroSlides() {
    const tenantId = await resolveSoleActiveTenantId(this.prisma);
    return this.prisma.homepageHeroSlide.findMany({
      where: this.heroTenantWhere(tenantId),
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: this.heroInclude(),
    });
  }

  async createHeroSlide(dto: HomepageHeroSlideDto) {
    const tenantId = await resolveSoleActiveTenantId(this.prisma);
    await this.assertProductBelongsToTenant(dto.productId, tenantId);
    return this.prisma.homepageHeroSlide.create({
      data: this.heroData(dto) as Prisma.HomepageHeroSlideUncheckedCreateInput,
      include: this.heroInclude(),
    });
  }

  async updateHeroSlide(id: string, dto: UpdateHomepageHeroSlideDto) {
    const tenantId = await resolveSoleActiveTenantId(this.prisma);
    await this.assertHeroSlide(id, tenantId);
    await this.assertProductBelongsToTenant(dto.productId, tenantId);

    return this.prisma.homepageHeroSlide.update({
      where: { id },
      data: this.heroData(dto) as Prisma.HomepageHeroSlideUncheckedUpdateInput,
      include: this.heroInclude(),
    });
  }

  async deleteHeroSlide(id: string) {
    const tenantId = await resolveSoleActiveTenantId(this.prisma);
    await this.assertHeroSlide(id, tenantId);

    return this.prisma.homepageHeroSlide.update({
      where: { id },
      data: { isActive: false },
      include: this.heroInclude(),
    });
  }

  async deleteHeroSlidesBulk(ids: string[]) {
    const tenantId = await resolveSoleActiveTenantId(this.prisma);
    return this.deleteHomepageRows(ids, "hero-slides", tenantId);
  }

  async listPromotions() {
    const tenantId = await resolveSoleActiveTenantId(this.prisma);
    return this.prisma.promotion.findMany({
      where: this.promotionTenantWhere(tenantId),
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: this.promotionInclude(),
    });
  }

  async createPromotion(dto: PromotionDto) {
    const tenantId = await resolveSoleActiveTenantId(this.prisma);
    await this.assertProductBelongsToTenant(dto.productId, tenantId);
    await this.assertCategoryBelongsToTenant(dto.categoryId, tenantId);
    return this.prisma.promotion.create({
      data: this.promotionData(dto) as Prisma.PromotionUncheckedCreateInput,
      include: this.promotionInclude(),
    });
  }

  async updatePromotion(id: string, dto: UpdatePromotionDto) {
    const tenantId = await resolveSoleActiveTenantId(this.prisma);
    await this.assertPromotion(id, tenantId);
    await this.assertProductBelongsToTenant(dto.productId, tenantId);
    await this.assertCategoryBelongsToTenant(dto.categoryId, tenantId);

    return this.prisma.promotion.update({
      where: { id },
      data: this.promotionData(dto) as Prisma.PromotionUncheckedUpdateInput,
      include: this.promotionInclude(),
    });
  }

  async deletePromotion(id: string) {
    const tenantId = await resolveSoleActiveTenantId(this.prisma);
    await this.assertPromotion(id, tenantId);

    return this.prisma.promotion.update({
      where: { id },
      data: { isActive: false },
      include: this.promotionInclude(),
    });
  }

  async deletePromotionsBulk(ids: string[]) {
    const tenantId = await resolveSoleActiveTenantId(this.prisma);
    return this.deleteHomepageRows(ids, "promotions", tenantId);
  }

  private async deleteHomepageRows(
    ids: string[],
    kind: "hero-slides" | "promotions",
    tenantId: string,
  ) {
    const uniqueIds = [
      ...new Set(
        (ids ?? []).filter((id) => typeof id === "string" && id.trim()),
      ),
    ];
    if (!uniqueIds.length) {
      throw new BadRequestException("Kamida bitta yozuv tanlanishi kerak");
    }

    if (kind === "hero-slides") {
      const count = await this.prisma.homepageHeroSlide.count({
        where: {
          AND: [{ id: { in: uniqueIds } }, this.heroTenantWhere(tenantId)],
        },
      });
      if (count !== uniqueIds.length)
        throw new NotFoundException("Tanlangan slaydlarning biri topilmadi");
      await this.prisma.homepageHeroSlide.deleteMany({
        where: {
          AND: [{ id: { in: uniqueIds } }, this.heroTenantWhere(tenantId)],
        },
      });
    } else {
      const count = await this.prisma.promotion.count({
        where: {
          AND: [{ id: { in: uniqueIds } }, this.promotionTenantWhere(tenantId)],
        },
      });
      if (count !== uniqueIds.length)
        throw new NotFoundException("Tanlangan aksiyalarning biri topilmadi");
      await this.prisma.promotion.deleteMany({
        where: {
          AND: [{ id: { in: uniqueIds } }, this.promotionTenantWhere(tenantId)],
        },
      });
    }

    return { deleted: true, count: uniqueIds.length, ids: uniqueIds };
  }

  private listActiveHeroSlides(tenantId: string) {
    return this.prisma.homepageHeroSlide.findMany({
      where: {
        isActive: true,
        AND: [
          ...this.activeWindowWhere().AND,
          {
            OR: [
              { productId: null },
              {
                product: {
                  is: {
                    AND: [
                      customerVisibleProductWhere(),
                      this.tenantProductWhere(tenantId),
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: this.heroInclude(),
    });
  }

  private listActivePromotions(tenantId: string) {
    return this.prisma.promotion.findMany({
      where: {
        isActive: true,
        AND: [
          ...this.activeWindowWhere().AND,
          {
            OR: [
              { productId: null },
              {
                product: {
                  is: {
                    AND: [
                      customerVisibleProductWhere(),
                      this.tenantProductWhere(tenantId),
                    ],
                  },
                },
              },
            ],
          },
          {
            OR: [
              { categoryId: null },
              { category: { is: this.tenantCategoryWhere(tenantId) } },
            ],
          },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: this.promotionInclude(),
    });
  }

  private async createProductHeroFallback(
    branchId: string | undefined,
    tenantId: string,
  ) {
    const products = await this.prisma.product.findMany({
      where: {
        isAvailable: true,
        isRecommended: true,
        ...customerVisibleProductWhere(),
        AND: [
          this.tenantProductWhere(tenantId),
          ...(branchId ? [{ OR: [{ branchId }, { branchId: null }] }] : []),
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 5,
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        sellingPrice: true,
        preparationTime: true,
        isCombo: true,
      },
    });

    return products.map((product, index) => ({
      id: `product-${product.id}`,
      title: product.name,
      subtitle:
        product.description ??
        "MAZETTO FOOD menyusidan issiq va tez tayyorlanadigan taom.",
      imageUrl: product.imageUrl,
      ctaLabel: "Buyurtma berish",
      targetUrl: `/product/${product.id}`,
      badge: product.isCombo ? "Set" : "Tavsiya",
      sortOrder: index,
      product,
    }));
  }

  private async assertBranchBelongsToTenant(
    branchId: string | undefined,
    tenantId: string,
  ) {
    if (!branchId) return;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException("Branch not found");
  }

  private async assertProductBelongsToTenant(
    productId: string | null | undefined,
    tenantId: string,
  ) {
    if (productId == null || productId === "") return;
    const product = await this.prisma.product.findFirst({
      where: { id: productId, AND: [this.tenantProductWhere(tenantId)] },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product not found");
  }

  private async assertCategoryBelongsToTenant(
    categoryId: string | null | undefined,
    tenantId: string,
  ) {
    if (categoryId == null || categoryId === "") return;
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, AND: [this.tenantCategoryWhere(tenantId)] },
      select: { id: true },
    });
    if (!category) throw new NotFoundException("Category not found");
  }

  private heroTenantWhere(
    tenantId: string,
  ): Prisma.HomepageHeroSlideWhereInput {
    return {
      OR: [
        { productId: null },
        { product: { is: this.tenantProductWhere(tenantId) } },
      ],
    };
  }

  private promotionTenantWhere(tenantId: string): Prisma.PromotionWhereInput {
    return {
      AND: [
        {
          OR: [
            { productId: null },
            { product: { is: this.tenantProductWhere(tenantId) } },
          ],
        },
        {
          OR: [
            { categoryId: null },
            { category: { is: this.tenantCategoryWhere(tenantId) } },
          ],
        },
      ],
    };
  }

  private tenantProductWhere(tenantId: string): Prisma.ProductWhereInput {
    return { OR: [{ branch: { tenantId } }, { branchId: null }] };
  }

  private tenantCategoryWhere(tenantId: string): Prisma.CategoryWhereInput {
    return { OR: [{ branch: { tenantId } }, { branchId: null }] };
  }

  private activeWindowWhere() {
    const now = new Date();

    return {
      isActive: true,
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
      ],
    } satisfies Prisma.HomepageHeroSlideWhereInput & Prisma.PromotionWhereInput;
  }

  private heroData(dto: Partial<HomepageHeroSlideDto>) {
    return {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.productId !== undefined
        ? { productId: dto.productId || null }
        : {}),
      ...(dto.targetUrl !== undefined ? { targetUrl: dto.targetUrl } : {}),
      ...(dto.ctaLabel !== undefined ? { ctaLabel: dto.ctaLabel } : {}),
      ...(dto.badge !== undefined ? { badge: dto.badge } : {}),
      ...(dto.accent !== undefined ? { accent: dto.accent } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.startAt !== undefined
        ? { startAt: dto.startAt ? new Date(dto.startAt) : null }
        : {}),
      ...(dto.endAt !== undefined
        ? { endAt: dto.endAt ? new Date(dto.endAt) : null }
        : {}),
    };
  }

  private promotionData(dto: Partial<PromotionDto>) {
    return {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.productId !== undefined
        ? { productId: dto.productId || null }
        : {}),
      ...(dto.categoryId !== undefined
        ? { categoryId: dto.categoryId || null }
        : {}),
      ...(dto.targetUrl !== undefined ? { targetUrl: dto.targetUrl } : {}),
      ...(dto.ctaLabel !== undefined ? { ctaLabel: dto.ctaLabel } : {}),
      ...(dto.badge !== undefined ? { badge: dto.badge } : {}),
      ...(dto.discountPercent !== undefined
        ? { discountPercent: new Prisma.Decimal(dto.discountPercent) }
        : {}),
      ...(dto.promotionalPrice !== undefined
        ? { promotionalPrice: new Prisma.Decimal(dto.promotionalPrice) }
        : {}),
      ...(dto.accent !== undefined ? { accent: dto.accent } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.startAt !== undefined
        ? { startAt: dto.startAt ? new Date(dto.startAt) : null }
        : {}),
      ...(dto.endAt !== undefined
        ? { endAt: dto.endAt ? new Date(dto.endAt) : null }
        : {}),
    };
  }

  private heroInclude() {
    return {
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          sellingPrice: true,
          preparationTime: true,
          isCombo: true,
        },
      },
    } satisfies Prisma.HomepageHeroSlideInclude;
  }

  private promotionInclude() {
    return {
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          sellingPrice: true,
          preparationTime: true,
          isCombo: true,
        },
      },
      category: { select: { id: true, name: true, imageUrl: true } },
    } satisfies Prisma.PromotionInclude;
  }

  private async assertHeroSlide(id: string, tenantId: string): Promise<void> {
    const slide = await this.prisma.homepageHeroSlide.findFirst({
      where: { id, ...this.heroTenantWhere(tenantId) },
      select: { id: true },
    });
    if (!slide) throw new NotFoundException("Homepage hero slide not found");
  }

  private async assertPromotion(id: string, tenantId: string): Promise<void> {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id, ...this.promotionTenantWhere(tenantId) },
      select: { id: true },
    });
    if (!promotion) throw new NotFoundException("Promotion not found");
  }
}
