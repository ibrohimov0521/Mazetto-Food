import { ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../types/authenticated-user";

const globalReportRoles = new Set(["SUPER_ADMIN", "ACCOUNTANT"]);
export type RestaurantRoleScope = { code: string; isBranchScoped: boolean };

export function isPlatformRoleCode(code: string): boolean {
  return code.startsWith("PLATFORM_");
}

export const restaurantUserWhere: Prisma.UserWhereInput = {
  roles: { none: { role: { code: { startsWith: "PLATFORM_" } } } },
};

export function hasRestaurantGlobalScope(roles: readonly RestaurantRoleScope[]): boolean {
  return roles.some((role) => !role.isBranchScoped && !isPlatformRoleCode(role.code));
}

export function resolveBranchScope(
  user: AuthenticatedUser,
  requestedBranchId?: string,
): string | undefined {
  const hasGlobalScope =
    user.isGlobalScope ??
    user.roles.some((role) => globalReportRoles.has(role));

  if (hasGlobalScope) {
    return requestedBranchId;
  }

  if (!user.branchId) {
    throw new ForbiddenException("Foydalanuvchi hech qanday filialga biriktirilmagan");
  }

  if (requestedBranchId && requestedBranchId !== user.branchId) {
    throw new ForbiddenException("Boshqa filialga kirish huquqi yo'q");
  }

  return user.branchId;
}

export function resolveRequiredBranchScope(
  user: AuthenticatedUser,
  requestedBranchId?: string,
): string {
  const branchId = resolveBranchScope(user, requestedBranchId);

  if (!branchId) {
    throw new ForbiddenException("Bu amal uchun filial tanlanishi shart");
  }

  return branchId;
}
