import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import type { CreateRestaurantTenantDto } from "./dto/create-platform-tenant.dto";
import type { TenantLifecycleConfirmationDto } from "./dto/tenant-lifecycle-confirmation.dto";

const protectedTenantCodes = new Set(["MAZETTO_FOOD"]);
const protectedTenantHosts = new Set([
  "mazettofood.uz",
  "www.mazettofood.uz",
  "pos.mazettofood.uz",
  "api.mazettofood.uz",
]);
const activeOrderStatuses = [
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
];

type RestorableTenantStatus = "PROVISIONING" | "ACTIVE" | "SUSPENDED";

function isRestorableStatus(value: unknown): value is RestorableTenantStatus {
  return value === "PROVISIONING" || value === "ACTIVE" || value === "SUSPENDED";
}

function archivedFromStatus(metadata: unknown): RestorableTenantStatus | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>).previousStatus;
  return isRestorableStatus(value) ? value : null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

@Injectable()
export class PlatformTenantLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async activationPreview(tenantId: string) {
    const tenant = await this.prisma.restaurantTenant.findUnique({
      where: { id: tenantId },
      select: { id: true, code: true, name: true, status: true, domains: { select: { hostname: true } } },
    });
    if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");

    const [branches, verifiedDomains, activeOwners, telegramFeature, telegramConfiguration] = await Promise.all([
      this.prisma.branch.count({ where: { tenantId } }),
      this.prisma.tenantDomain.count({ where: { tenantId, status: "VERIFIED" } }),
      this.prisma.tenantMembership.count({
        where: {
          tenantId,
          status: "ACTIVE",
          user: { isActive: true },
          roles: { some: { role: { code: "SUPER_ADMIN", isActive: true } } },
        },
      }),
      this.prisma.tenantFeature.findUnique({ where: { tenantId_code: { tenantId, code: "TELEGRAM_ORDERS" } }, select: { isEnabled: true } }),
      this.prisma.tenantTelegramConfiguration.findUnique({ where: { tenantId }, select: { staffChatId: true } }),
    ]);
    const platformActivationEnabled = process.env.PLATFORM_TENANT_ACTIVATION_ENABLED === "true";
    const telegramReady = !telegramFeature?.isEnabled || Boolean(
      (telegramConfiguration?.staffChatId || (tenant.code === "MAZETTO_FOOD" && process.env.TELEGRAM_STAFF_CHAT_ID)) && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET,
    );
    const blockers = [
      ...(tenant.status !== "PROVISIONING" ? ["Faqat tayyorlanayotgan tenantni faollashtirish mumkin."] : []),
      ...(!platformActivationEnabled ? ["Platforma xavfsizlik darvozasi yopiq: tenantlararo izolyatsiya va domenning sayt/POS marshruti tekshirilmaguncha faollashtirish mumkin emas."] : []),
      ...(this.isProtectedTenant(tenant) ? ["Mazetto Food asosiy restorani bu amal bilan o'zgartirilmaydi."] : []),
      ...(branches < 1 ? ["Kamida bitta filial yarating."] : []),
      ...(verifiedDomains < 1 ? ["Kamida bitta domenni DNS orqali tasdiqlang."] : []),
      ...(activeOwners < 1 ? ["Faol SUPER_ADMIN a'zoligi va foydalanuvchi hisobini tekshiring."] : []),
      ...(!telegramReady ? ["Telegram yoqilgan: xodimlar guruhi va server bot webhook sozlamalarini tekshiring."] : []),
    ];
    return {
      tenant: { id: tenant.id, code: tenant.code, name: tenant.name, status: tenant.status },
      readiness: { branches, verifiedDomains, activeOwners, telegramReady, platformActivationEnabled },
      blockers,
      canActivate: blockers.length === 0,
    };
  }

  async activate(
    tenantId: string,
    dto: TenantLifecycleConfirmationDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.restaurantTenant.findUnique({
        where: { id: tenantId },
        select: { id: true, code: true, name: true, status: true, domains: { select: { hostname: true } } },
      });
      if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");
      if (tenant.status !== "PROVISIONING") {
        throw new ConflictException("Faqat tayyorlanayotgan tenantni faollashtirish mumkin.");
      }
      if (this.isProtectedTenant(tenant)) {
        throw new ConflictException("Mazetto Food asosiy restoranini bu amal bilan o'zgartirib bo'lmaydi.");
      }
      if (process.env.PLATFORM_TENANT_ACTIVATION_ENABLED !== "true") {
        throw new ConflictException("Platforma xavfsizlik darvozasi yopiq: tenantlararo izolyatsiya va domenning sayt/POS marshruti tekshirilmaguncha faollashtirish mumkin emas.");
      }
      this.assertConfirmation(tenant.code, dto);

      const [branches, verifiedDomains, activeOwners] = await Promise.all([
        tx.branch.count({ where: { tenantId } }),
        tx.tenantDomain.count({ where: { tenantId, status: "VERIFIED" } }),
        tx.tenantMembership.count({
          where: {
            tenantId,
            status: "ACTIVE",
            user: { isActive: true },
            roles: { some: { role: { code: "SUPER_ADMIN", isActive: true } } },
          },
        }),
      ]);
      if (branches < 1) throw new ConflictException("Faollashtirishdan oldin kamida bitta filial yarating.");
      if (verifiedDomains < 1) throw new ConflictException("Faollashtirishdan oldin kamida bitta domenni DNS orqali tasdiqlang.");
      if (activeOwners < 1) throw new ConflictException("Faollashtirishdan oldin faol SUPER_ADMIN egasini tekshiring.");
      const [telegramFeature, telegramConfiguration] = await Promise.all([
        tx.tenantFeature.findUnique({ where: { tenantId_code: { tenantId, code: "TELEGRAM_ORDERS" } }, select: { isEnabled: true } }),
        tx.tenantTelegramConfiguration.findUnique({ where: { tenantId }, select: { staffChatId: true } }),
      ]);
      if (telegramFeature?.isEnabled && (!(telegramConfiguration?.staffChatId || (tenant.code === "MAZETTO_FOOD" && process.env.TELEGRAM_STAFF_CHAT_ID)) || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET)) {
        throw new ConflictException("Telegram yoqilgan: xodimlar guruhi va server bot webhook sozlamalarini tekshiring.");
      }

      const updated = await tx.restaurantTenant.updateMany({
        where: { id: tenantId, status: "PROVISIONING" },
        data: { status: "ACTIVE" },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Restoran holati o'zgargan; reyestrni yangilab qayta urinib ko'ring.");
      }
      await writeAuditLog(tx, {
        tenantId,
        userId: actor.id,
        action: "PLATFORM_TENANT_ACTIVATED",
        entity: "RESTAURANT_TENANT",
        entityId: tenantId,
        metadata: {
          tenantId,
          code: tenant.code,
          name: tenant.name,
          reason: dto.reason.trim(),
          readiness: { branches, verifiedDomains, activeOwners },
          branchesRemainOrderDisabled: true,
        },
      });
      return { id: tenant.id, code: tenant.code, name: tenant.name, status: "ACTIVE" as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException("Restoran sozlamalari o'zgargan; reyestrni yangilab qayta tekshiring.");
      }
      throw error;
    });
  }

  async archivePreview(tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.restaurantTenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          domains: { select: { hostname: true } },
        },
      });
      if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");

      const records = await this.lifecycleRecordCounts(tx, tenantId);
      const protectedTenant = this.isProtectedTenant(tenant);
      const restoreAudit = tenant.status === "ARCHIVED"
        ? await tx.auditLog.findFirst({
          where: {
            action: "PLATFORM_TENANT_ARCHIVED",
            entity: "RESTAURANT_TENANT",
            entityId: tenantId,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { metadata: true },
        })
        : null;
      const restoreStatus = archivedFromStatus(restoreAudit?.metadata);
      const blockReason = protectedTenant
        ? "Mazetto Food asosiy restorani arxivlanmaydi."
        : tenant.status === "ARCHIVED"
          ? null
          : this.archiveBlockReason(records);

      return {
        tenant: {
          id: tenant.id,
          code: tenant.code,
          name: tenant.name,
          status: tenant.status,
        },
        records,
        canArchive: tenant.status !== "ARCHIVED" && blockReason === null,
        blockReason,
        restoreStatus,
      };
    });
  }

  async archive(
    tenantId: string,
    dto: TenantLifecycleConfirmationDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.restaurantTenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          domains: { select: { hostname: true } },
        },
      });
      if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");
      if (tenant.status === "ARCHIVED") {
        throw new ConflictException("Restoran allaqachon arxivlangan.");
      }
      if (this.isProtectedTenant(tenant)) {
        throw new ConflictException("Mazetto Food asosiy restoranini arxivlab bo'lmaydi.");
      }
      this.assertConfirmation(tenant.code, dto);
      const previousStatus = tenant.status;

      const records = await this.lifecycleRecordCounts(tx, tenantId);
      const blockReason = this.archiveBlockReason(records);
      if (blockReason) throw new ConflictException(blockReason);

      const updated = await tx.restaurantTenant.updateMany({
        where: { id: tenantId, status: previousStatus },
        data: { status: "ARCHIVED" },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          "Restoran holati o'zgargan; reyestrni yangilab qayta urinib ko'ring.",
        );
      }

      await writeAuditLog(tx, {
        tenantId,
        userId: actor.id,
        action: "PLATFORM_TENANT_ARCHIVED",
        entity: "RESTAURANT_TENANT",
        entityId: tenantId,
        metadata: {
          tenantId,
          code: tenant.code,
          name: tenant.name,
          previousStatus,
          reason: dto.reason.trim(),
          records,
        },
      });

      return {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
        status: "ARCHIVED" as const,
        previousStatus,
        records,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }).catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        throw new ConflictException(
          "Buyurtma holati o'zgargan; reyestrni yangilab qayta tekshiring.",
        );
      }
      throw error;
    });
  }

  async restore(
    tenantId: string,
    dto: TenantLifecycleConfirmationDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.restaurantTenant.findUnique({
        where: { id: tenantId },
        select: { id: true, code: true, name: true, status: true },
      });
      if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");
      if (tenant.status !== "ARCHIVED") {
        throw new ConflictException("Faqat arxivlangan restoranni tiklash mumkin.");
      }
      this.assertConfirmation(tenant.code, dto);

      const archiveAudit = await tx.auditLog.findFirst({
        where: {
          action: "PLATFORM_TENANT_ARCHIVED",
          entity: "RESTAURANT_TENANT",
          entityId: tenantId,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { metadata: true },
      });
      const restoredStatus = archivedFromStatus(archiveAudit?.metadata);
      if (!restoredStatus) {
        throw new ConflictException(
          "Tiklash uchun arxiv amali tarixi topilmadi; platform yordamiga murojaat qiling.",
        );
      }
      if (restoredStatus === "ACTIVE") {
        const [verifiedDomains, activeOwners, branches] = await Promise.all([
          tx.tenantDomain.count({ where: { tenantId, status: "VERIFIED" } }),
          tx.tenantMembership.count({
            where: {
              tenantId,
              status: "ACTIVE",
              user: { isActive: true },
              roles: { some: { role: { code: "SUPER_ADMIN", isActive: true } } },
            },
          }),
          tx.branch.count({ where: { tenantId } }),
        ]);
        if (verifiedDomains < 1 || activeOwners < 1 || branches < 1) {
          throw new ConflictException(
            "Faol holatga tiklash uchun tasdiqlangan domen, faol egasi va kamida bitta filial kerak.",
          );
        }
      }

      const updated = await tx.restaurantTenant.updateMany({
        where: { id: tenantId, status: "ARCHIVED" },
        data: { status: restoredStatus },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          "Restoran holati o'zgargan; reyestrni yangilab qayta urinib ko'ring.",
        );
      }

      await writeAuditLog(tx, {
        tenantId,
        userId: actor.id,
        action: "PLATFORM_TENANT_RESTORED",
        entity: "RESTAURANT_TENANT",
        entityId: tenantId,
        metadata: {
          tenantId,
          code: tenant.code,
          name: tenant.name,
          fromStatus: "ARCHIVED",
          restoredStatus,
          reason: dto.reason.trim(),
        },
      });

      return {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
        status: restoredStatus,
      };
    });
  }

  private async lifecycleRecordCounts(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ) {
    const [
      branches,
      domains,
      verifiedDomains,
      memberships,
      customers,
      orders,
      payments,
      openOrders,
      openShifts,
      pendingCashTransfers,
      platformSites,
    ] = await Promise.all([
      tx.branch.count({ where: { tenantId } }),
      tx.tenantDomain.count({ where: { tenantId } }),
      tx.tenantDomain.count({ where: { tenantId, status: "VERIFIED" } }),
      tx.tenantMembership.count({ where: { tenantId } }),
      tx.customer.count({ where: { tenantId } }),
      tx.order.count({ where: { tenantId } }),
      tx.payment.count({ where: { order: { is: { tenantId } } } }),
      tx.order.count({
        where: { tenantId, status: { in: activeOrderStatuses } },
      }),
      tx.shift.count({ where: { status: "OPEN", branch: { tenantId } } }),
      tx.cashTransfer.count({
        where: { status: { in: ["PENDING", "DISPUTED"] }, branch: { tenantId } },
      }),
      tx.platformSite.count({ where: { tenantId } }),
    ]);
    return {
      branches,
      domains,
      verifiedDomains,
      memberships,
      customers,
      orders,
      payments,
      openOrders,
      openShifts,
      pendingCashTransfers,
      platformSites,
    };
  }

  private archiveBlockReason(records: { openOrders: number; openShifts: number; pendingCashTransfers: number }): string | null {
    if (records.openOrders > 0) return "Arxivlashdan oldin ochiq buyurtmalarni yakunlang yoki bekor qiling.";
    if (records.openShifts > 0) return "Arxivlashdan oldin barcha ochiq kassa smenalarini yoping.";
    if (records.pendingCashTransfers > 0) return "Arxivlashdan oldin kutilayotgan yoki nizoli pul o'tkazmalarini hal qiling.";
    return null;
  }

  private isProtectedTenant(tenant: {
    code: string;
    domains: Array<{ hostname: string }>;
  }) {
    return protectedTenantCodes.has(tenant.code)
      || tenant.domains.some((domain) => protectedTenantHosts.has(domain.hostname.toLowerCase()));
  }

  private assertConfirmation(
    tenantCode: string,
    dto: TenantLifecycleConfirmationDto,
  ) {
    if (dto.confirmationCode.trim() !== tenantCode) {
      throw new BadRequestException(
        "Tasdiqlash uchun restoran kodini aynan kiriting.",
      );
    }
    if (dto.reason.trim().length < 10) {
      throw new BadRequestException(
        "Amal sababi kamida 10 ta belgidan iborat bo'lsin.",
      );
    }
  }

  async create(dto: CreateRestaurantTenantDto, actor: AuthenticatedUser) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();

    if (!/^[A-Z0-9](?:[A-Z0-9_-]{0,30}[A-Z0-9])$/.test(code)) {
      throw new BadRequestException("Restoran kodi 2-32 ta harf yoki raqamdan iborat bo'lsin.");
    }
    if (name.length < 2 || name.length > 120) {
      throw new BadRequestException("Restoran nomi 2-120 ta belgidan iborat bo'lsin.");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.restaurantTenant.create({
          data: { code, name, status: "PROVISIONING" },
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await writeAuditLog(tx, {
          tenantId: tenant.id,
          userId: actor.id,
          action: "PLATFORM_TENANT_CREATED",
          entity: "RESTAURANT_TENANT",
          entityId: tenant.id,
          metadata: {
            tenantId: tenant.id,
            code: tenant.code,
            name: tenant.name,
            status: tenant.status,
          },
        });

        return tenant;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Bu restoran kodi allaqachon mavjud.");
      }
      throw error;
    }
  }
}
