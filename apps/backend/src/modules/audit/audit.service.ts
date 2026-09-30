import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { hasOnlyPlatformRoles } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { ListAuditLogsDto } from "./dto/list-audit-logs.dto";

/*
 * Audit jurnali — faqat o'qish.
 *
 * `AuditLog` modeli allaqachon mavjud edi va `StaffService` unga yozadi
 * (STAFF_CREATED, STAFF_ROLE_CHANGED, STAFF_BLOCKED va h.k.), lekin uni
 * o'qish uchun endpoint yo'q edi — ya'ni yozuvlar hech kimga ko'rinmasdi.
 *
 * Tenant a'zosi faqat o'z tenantiga biriktirilgan yozuvlarni ko'radi.
 * Egasi ko'rsatilmagan eski yozuvlarni faqat platform egasi ko'rishi mumkin.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  listAuditLogs(query: ListAuditLogsDto, user: AuthenticatedUser) {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException(
        "Boshlanish sanasi tugash sanasidan keyin bo'lmasligi kerak",
      );
    }
    const createdAt =
      query.from || query.to
        ? {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          }
        : undefined;

    return this.prisma.auditLog.findMany({
      where: {
        ...(query.action ? { action: query.action } : {}),
        ...this.scopeWhere(user),
        ...(query.entity ? { entity: query.entity } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: query.offset,
      take: query.limit,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  /** Filtr tanlagichlarini to'ldirish uchun mavjud action va entity qiymatlari. */
  async listAuditFacets(user: AuthenticatedUser) {
    const where = this.scopeWhere(user);
    const [actions, entities] = await Promise.all([
      this.prisma.auditLog.findMany({
        distinct: ["action"],
        select: { action: true },
        where,
        orderBy: { action: "asc" },
      }),
      this.prisma.auditLog.findMany({
        distinct: ["entity"],
        select: { entity: true },
        where,
        orderBy: { entity: "asc" },
      }),
    ]);

    return {
      actions: actions.map((row) => row.action),
      entities: entities.map((row) => row.entity),
    };
  }
  private scopeWhere(user: AuthenticatedUser) {
    if (Boolean(user.tenantId) !== Boolean(user.membershipId)) {
      throw new ForbiddenException("Audit uchun tenant membership konteksti noto'g'ri.");
    }
    if (user.tenantId) return { tenantId: user.tenantId };
    if (hasOnlyPlatformRoles(user.roles)) return {};
    throw new ForbiddenException("Audit jurnaliga platform egasi yoki tenant a'zosi kirishi mumkin.");
  }
}
