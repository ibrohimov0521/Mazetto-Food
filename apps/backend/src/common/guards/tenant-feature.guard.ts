import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service";
import { TENANT_FEATURE_KEY } from "../decorators/tenant-feature.decorator";
import type { TenantFeatureCode } from "../tenant/tenant-feature-catalog";
import type { AuthenticatedRequest } from "../types/authenticated-user";

@Injectable()
export class TenantFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<TenantFeatureCode>(
      TENANT_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const trustedTenantId =
      request.tenantContext?.kind === "TRUSTED"
        ? request.tenantContext.tenantId
        : undefined;
    const tenantId = request.user?.tenantId ?? trustedTenantId;
    if (!tenantId || (trustedTenantId && trustedTenantId !== tenantId)) {
      throw new ForbiddenException("Restoran domeni tasdiqlanmagan.");
    }

    const enabled = await this.prisma.tenantFeature.findUnique({
      where: { tenantId_code: { tenantId, code: feature } },
      select: { isEnabled: true },
    });
    if (!enabled?.isEnabled) {
      throw new ForbiddenException("Bu restoran uchun ushbu funksiya o‘chirilgan.");
    }
    return true;
  }
}
