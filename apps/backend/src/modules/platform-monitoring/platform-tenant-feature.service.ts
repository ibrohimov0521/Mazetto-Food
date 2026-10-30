import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { isTenantFeatureCode, TENANT_FEATURES, type TenantFeatureCode } from "../../common/tenant/tenant-feature-catalog";
import { PrismaService } from "../../prisma/prisma.service";
import { KitchenGateway } from "../kitchen/kitchen.gateway";
import { writeAuditLog } from "../audit/audit-write";

@Injectable()
export class PlatformTenantFeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenGateway: KitchenGateway,
  ) {}

  async list(tenantId: string) {
    const tenant = await this.prisma.restaurantTenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");
    const enabled = new Set((await this.prisma.tenantFeature.findMany({
      where: { tenantId, isEnabled: true },
      select: { code: true },
    })).map(({ code }) => code));
    return TENANT_FEATURES.map((feature) => ({ ...feature, isEnabled: enabled.has(feature.code) }));
  }

  async replace(tenantId: string, enabledCodes: string[], actor: AuthenticatedUser) {
    const uniqueCodes = [...new Set(enabledCodes)];
    if (uniqueCodes.length !== enabledCodes.length) throw new BadRequestException("Bir xil funksiyani takroran yubormang.");
    if (uniqueCodes.some((code) => !isTenantFeatureCode(code))) throw new BadRequestException("Noma’lum restoran funksiyasi tanlandi.");
    const enabled = new Set(uniqueCodes as TenantFeatureCode[]);
    if (enabled.has("WEB_ORDERS") && !enabled.has("CUSTOMER_WEB")) {
      throw new BadRequestException("Saytdan buyurtma uchun mijozlar sayti ham yoqilgan bo‘lishi kerak.");
    }
    if (enabled.has("TV_DISPLAY") && !enabled.has("KITCHEN_DISPLAY")) {
      throw new BadRequestException("Televizor rejimi uchun oshxona paneli ham yoqilgan bo‘lishi kerak.");
    }

    await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.restaurantTenant.findUnique({ where: { id: tenantId }, select: { id: true, code: true } });
      if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");
      if (enabled.has("TELEGRAM_ORDERS")) {
        const telegram = await tx.tenantTelegramConfiguration.findUnique({
          where: { tenantId },
          select: { staffChatId: true },
        });
        if (!telegram?.staffChatId && !(tenant.code === "MAZETTO_FOOD" && process.env.TELEGRAM_STAFF_CHAT_ID)) {
          throw new BadRequestException("Telegram buyurtmalarini yoqishdan oldin xodimlar guruhining Chat ID raqamini sozlang.");
        }
      }
      for (const feature of TENANT_FEATURES) {
        await tx.tenantFeature.upsert({
          where: { tenantId_code: { tenantId, code: feature.code } },
          create: { tenantId, code: feature.code, isEnabled: enabled.has(feature.code) },
          update: { isEnabled: enabled.has(feature.code) },
        });
      }
      await writeAuditLog(tx, {
        tenantId, userId: actor.id, action: "PLATFORM_TENANT_FEATURES_UPDATED",
        entity: "RESTAURANT_TENANT", entityId: tenantId,
        metadata: { enabledCodes: uniqueCodes },
      });
    });
    for (const featureCode of ["CUSTOMER_WEB", "KITCHEN_DISPLAY"] as const) {
      if (!enabled.has(featureCode)) {
        this.kitchenGateway.disconnectTenantFeature(tenantId, featureCode);
      }
    }
    return this.list(tenantId);
  }

  async assertEnabled(tenantId: string, code: TenantFeatureCode): Promise<void> {
    const feature = await this.prisma.tenantFeature.findUnique({
      where: { tenantId_code: { tenantId, code } },
      select: { isEnabled: true },
    });
    if (!feature?.isEnabled) throw new BadRequestException("Ushbu restoran uchun bu funksiya yoqilmagan.");
  }

  static isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
