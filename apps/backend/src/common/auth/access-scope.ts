import { ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../types/authenticated-user";

const globalReportRoles = new Set(["SUPER_ADMIN", "ACCOUNTANT"]);

export function resolveBranchScope(
  user: AuthenticatedUser,
  requestedBranchId?: string,
): string | undefined {
  const hasGlobalScope = user.roles.some((role) => globalReportRoles.has(role));

  if (hasGlobalScope) {
    return requestedBranchId;
  }

  if (!user.branchId) {
    throw new ForbiddenException("Authenticated user is not assigned to a branch");
  }

  if (requestedBranchId && requestedBranchId !== user.branchId) {
    throw new ForbiddenException("Cannot access another branch");
  }

  return user.branchId;
}

export function resolveRequiredBranchScope(
  user: AuthenticatedUser,
  requestedBranchId?: string,
): string {
  const branchId = resolveBranchScope(user, requestedBranchId);

  if (!branchId) {
    throw new ForbiddenException("Branch is required for this operation");
  }

  return branchId;
}
