import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { customerVisibleProductCodes } from "../customers/customer-catalog-visibility";
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
    const [configuredHeroSlides, promotions] = await Promise.all([
      this.listActiveHeroSlides(),
      this.listActivePromotions(),
    ]);

    return {
      heroSlides: configuredHeroSlides.length
        ? configuredHeroSlides
        : await this.createProductHeroFallback(branchId),
      promotions,
    };
  }

  listHeroSlides() {
    return this.prisma.homepageHeroSlide.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: this.heroInclude(),
    });
  }

  createHeroSlide(dto: HomepageHeroSlideDto) {
    return this.prisma.homepageHeroSlide.create({
      data: this.heroData(dto) as Prisma.HomepageHeroSlideUncheckedCreateInput,
      include: this.heroInclude(),
    });
  }

  async updateHeroSlide(id: string, dto: UpdateHomepageHeroSlideDto) {
    await this.assertHeroSlide(id);

    return this.prisma.homepageHeroSlide.update({
      where: { id },
      data: this.heroData(dto) as Prisma.HomepageHeroSlideUncheckedUpdateInput,
      include: this.heroInclude(),
    });
  }

  async deleteHeroSlide(id: string) {
    await this.assertHeroSlide(id);

    return this.prisma.homepageHeroSlide.update({
      where: { id },
      data: { isActive: false },
      include: this.heroInclude(),
    });
  }

  listPromotions() {
    return this.prisma.promotion.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: this.promotionInclude(),
    });
  }

  createPromotion(dto: PromotionDto) {
    return this.prisma.promotion.create({
      data: this.promotionData(dto) as Prisma.PromotionUncheckedCreateInput,
      include: this.promotionInclude(),
    });
  }

  async updatePromotion(id: string, dto: UpdatePromotionDto) {
    await this.assertPromotion(id);

    return this.prisma.promotion.update({
      where: { id },
      data: this.promotionData(dto) as Prisma.PromotionUncheckedUpdateInput,
      include: this.promotionInclude(),
    });
  }

  async deletePromotion(id: string) {
    await this.assertPromotion(id);

    return this.prisma.promotion.update({
      where: { id },
      data: { isActive: false },
      include: this.promotionInclude(),
    });
  }

  private listActiveHeroSlides() {
    return this.prisma.homepageHeroSlide.findMany({
      where: {
        ...this.activeWindowWhere(),
        OR: [
          { productId: null },
          { product: { is: { code: { in: [...customerVisibleProductCodes] } } } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: this.heroInclude(),
    });
  }

  private listActivePromotions() {
    return this.prisma.promotion.findMany({
      where: {
        ...this.activeWindowWhere(),
        OR: [
          { productId: null },
          { product: { is: { code: { in: [...customerVisibleProductCodes] } } } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: this.promotionInclude(),
    });
  }

  private async createProductHeroFallback(branchId?: string) {
    const products = await this.prisma.product.findMany({
      where: {
        isAvailable: true,
        isRecommended: true,
        code: { in: [...customerVisibleProductCodes] },
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
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

  private activeWindowWhere() {
    const now = new Date();

    return {
      isActive: true,
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
      ],
    } satisfies Prisma.HomepageHeroSlideWhereInput &
      Prisma.PromotionWhereInput;
  }

  private heroData(dto: Partial<HomepageHeroSlideDto>) {
    return {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.productId !== undefined ? { productId: dto.productId || null } : {}),
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
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.productId !== undefined ? { productId: dto.productId || null } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
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

  private async assertHeroSlide(id: string): Promise<void> {
    const slide = await this.prisma.homepageHeroSlide.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!slide) {
      throw new NotFoundException("Homepage hero slide not found");
    }
  }

  private async assertPromotion(id: string): Promise<void> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!promotion) {
      throw new NotFoundException("Promotion not found");
    }
  }
}
