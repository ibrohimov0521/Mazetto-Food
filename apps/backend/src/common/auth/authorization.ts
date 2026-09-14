import { ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../types/authenticated-user";

export function hasPermission(
  user: AuthenticatedUser | undefined,
  permission: string,
): boolean {
  return Boolean(
    user &&
      (user.permissions.includes("*") || user.permissions.includes(permission)),
  );
}

export function hasAllPermissions(
  user: AuthenticatedUser | undefined,
  permissions: readonly string[],
): boolean {
  return permissions.every((permission) => hasPermission(user, permission));
}

export function assertPermission(
  user: AuthenticatedUser | undefined,
  permission: string,
): asserts user is AuthenticatedUser {
  if (!hasPermission(user, permission)) {
    throw new ForbiddenException("Missing required permission");
  }
}
