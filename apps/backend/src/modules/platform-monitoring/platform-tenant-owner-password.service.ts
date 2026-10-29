import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { UserAuthCacheService } from "../../common/auth/user-auth-cache.service";
import { PrismaService } from "../../prisma/prisma.service";
import { writeAuditLog } from "../audit/audit-write";
import { KitchenGateway } from "../kitchen/kitchen.gateway";
import type { ResetPlatformTenantOwnerPasswordDto } from "./dto/reset-platform-tenant-owner-password.dto";

@Injectable()
export class PlatformTenantOwnerPasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userAuthCache: UserAuthCacheService,
    private readonly kitchenGateway: KitchenGateway,
  ) {}

  async resetPassword(
    tenantId: string,
    userId: string,
    dto: ResetPlatformTenantOwnerPasswordDto,
    actor: AuthenticatedUser,
  ) {
    if (dto.newPassword !== dto.confirmation) {
      throw new BadRequestException("Yangi parollar mos kelmadi.");
    }
    if (dto.newPassword.length < 12 || dto.newPassword.length > 128) {
      throw new BadRequestException("Yangi parol 12–128 ta belgidan iborat bo‘lsin.");
    }
    if (actor.id === userId) {
      throw new BadRequestException("Platformadagi o‘z hisobingiz parolini bu bo‘limdan almashtirib bo‘lmaydi.");
    }

    const passwordHash = await hash(dto.newPassword, 12);
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.restaurantTenant.findUnique({
        where: { id: tenantId },
        select: { id: true, code: true, name: true, status: true },
      });
      if (!tenant) throw new NotFoundException("Restoran tenanti topilmadi.");
      if (tenant.status === "ARCHIVED") {
        throw new ConflictException("Arxivlangan restoran egasi parolini bu bo‘limdan tiklab bo‘lmaydi.");
      }

      const membership = await tx.tenantMembership.findFirst({
        where: {
          tenantId,
          userId,
          status: "ACTIVE",
          user: { isActive: true },
          roles: { some: { role: { code: "SUPER_ADMIN", isActive: true } } },
        },
        select: { user: { select: { id: true, isActive: true } } },
      });
      if (!membership?.user.isActive) {
        throw new NotFoundException("Faol restoran egasi hisobi topilmadi.");
      }

      const updated = await tx.user.updateMany({
        where: { id: userId, isActive: true },
        data: {
          passwordHash,
          credentialVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new NotFoundException("Faol restoran egasi hisobi topilmadi.");
      }

      const revoked = await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: actor.id,
        action: "PLATFORM_TENANT_OWNER_PASSWORD_RESET",
        entity: "User",
        entityId: userId,
        metadata: {
          tenantId,
          tenantCode: tenant.code,
          tenantName: tenant.name,
          ownerUserId: userId,
          revokedSessions: revoked.count,
        },
      });
      return { revokedSessions: revoked.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await this.userAuthCache.invalidate(userId);
    this.kitchenGateway.disconnectStaffUser(userId);
    return { changed: true, revokedSessions: result.revokedSessions };
  }
}
