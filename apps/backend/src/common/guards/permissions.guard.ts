import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAllPermissions } from "../auth/authorization";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import type { AuthenticatedRequest } from "../types/authenticated-user";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const canAccess = hasAllPermissions(request.user, requiredPermissions);

    if (!canAccess) {
      throw new ForbiddenException("Missing required permission");
    }

    return true;
  }
}
