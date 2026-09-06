import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { ListAuditLogsDto } from "./dto/list-audit-logs.dto";

/*
 * Audit jurnali — faqat o'qish.
 *
 * `AuditLog` modeli allaqachon mavjud edi va `StaffService` unga yozadi
 * (STAFF_CREATED, STAFF_ROLE_CHANGED, STAFF_BLOCKED va h.k.), lekin uni
 * o'qish uchun endpoint yo'q edi — ya'ni yozuvlar hech kimga ko'rinmasdi.
 *
 * DIQQAT: `AuditLog` da `branchId` yo'q — jurnal tabiatan global.
 * Shuning uchun bu endpoint branch scope qo'llamaydi va `AUDIT_VIEW`
 * permission'i faqat global rolga (SUPER_ADMIN) beriladi.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  listAuditLogs(query: ListAuditLogsDto) {
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
        ...(query.entity ? { entity: query.entity } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: "desc" },
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
  async listAuditFacets() {
    const [actions, entities] = await Promise.all([
      this.prisma.auditLog.findMany({
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
      }),
      this.prisma.auditLog.findMany({
        distinct: ["entity"],
        select: { entity: true },
        orderBy: { entity: "asc" },
      }),
    ]);

    return {
      actions: actions.map((row) => row.action),
      entities: entities.map((row) => row.entity),
    };
  }
}
