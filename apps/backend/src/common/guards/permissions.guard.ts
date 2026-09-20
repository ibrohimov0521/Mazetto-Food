import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAllPermissions, hasAnyPermission } from "../auth/authorization";
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from "../decorators/permissions.decorator";
import type { AuthenticatedRequest } from "../types/authenticated-user";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const anyPermissions =
      this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0 && anyPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const canAccess =
      hasAllPermissions(request.user, requiredPermissions) &&
      (anyPermissions.length === 0 ||
        hasAnyPermission(request.user, anyPermissions));

    if (!canAccess) {
      throw new ForbiddenException("Missing required permission");
    }

    return true;
  }
}