import { Injectable } from "@nestjs/common";
import { hasRestaurantGlobalScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TenantMembershipAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string, tenantId: string, membershipId?: string): Promise<AuthenticatedUser | null> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        userId,
        tenantId,
        status: "ACTIVE",
        ...(membershipId ? { id: membershipId } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        tenant: { select: { status: true } },
        branch: { select: { tenantId: true } },
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            credentialVersion: true,
            isActive: true,
            employee: {
              select: {
                id: true,
                branchId: true,
                status: true,
                branch: { select: { tenantId: true } },
              },
            },
          },
        },
        roles: {
          where: { role: { isActive: true } },
          select: {
            role: {
              select: {
                code: true,
                isBranchScoped: true,
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (
      !membership ||
      !membership.user.isActive ||
      membership.tenant.status !== "ACTIVE" ||
      (membership.branchId && membership.branch?.tenantId !== tenantId)
    ) {
      return null;
    }

    const roles = membership.roles.filter(({ role }) => !role.code.startsWith("PLATFORM_"));
    const employee =
      membership.user.employee?.status === "ACTIVE" &&
      membership.user.employee.branchId === membership.branchId &&
      membership.user.employee.branch.tenantId === tenantId
        ? membership.user.employee
        : null;

    if (roles.some(({ role }) => role.isBranchScoped) && (!membership.branchId || !employee)) {
      return null;
    }

    return {
      id: membership.user.id,
      ...(membership.user.email ? { email: membership.user.email } : {}),
      ...(membership.user.phone ? { phone: membership.user.phone } : {}),
      credentialVersion: membership.user.credentialVersion,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      ...(membership.branchId ? { branchId: membership.branchId } : {}),
      ...(employee ? { employeeId: employee.id } : {}),
      isGlobalScope: hasRestaurantGlobalScope(roles.map(({ role }) => role)),
      roles: roles.map(({ role }) => role.code),
      permissions: roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.code),
      ),
    };
  }
}
