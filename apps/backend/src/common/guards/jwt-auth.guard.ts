import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { timingSafeEqual } from "node:crypto";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import {
  hasOnlyPlatformRoles,
  hasRestaurantGlobalScope,
} from "../auth/access-scope";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "../types/authenticated-user";
import { getJwtAccessSecret } from "../../config/auth.config";
import { PrismaService } from "../../prisma/prisma.service";
import { UserAuthCacheService } from "../auth/user-auth-cache.service";
import { hashDeviceToken } from "../../modules/devices/devices.service";
import { TenantRequestContextService } from "../tenant/tenant-request-context.service";
import { TenantMembershipAuthService } from "../../modules/auth/tenant-membership-auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly userAuthCache: UserAuthCacheService,
    private readonly tenantRequestContext: TenantRequestContextService,
    private readonly tenantMembershipAuth: TenantMembershipAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantContext = await this.tenantRequestContext.resolve(
      request.headers.host,
    );
    request.tenantContext = tenantContext;
    if (tenantContext.kind === "BLOCKED") {
      throw new ForbiddenException(
        "Bu domen faol va tasdiqlangan restoranga tegishli emas.",
      );
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(
        token,
        {
          secret: getJwtAccessSecret(),
        },
      );
      const hasTenantBinding = Boolean(
        payload.tenantId && payload.membershipId,
      );
      if (Boolean(payload.tenantId) !== Boolean(payload.membershipId)) {
        throw new ForbiddenException("Tenant-bound token noto'g'ri.");
      }
      if (tenantContext.kind === "TRUSTED") {
        if (!hasTenantBinding || tenantContext.tenantId !== payload.tenantId) {
          throw new ForbiddenException(
            "Bu sessiya boshqa restoran yoki domen uchun berilgan.",
          );
        }
      } else if (hasTenantBinding) {
        throw new ForbiddenException(
          "Restoran domeni tasdiqlanmagan yoki boshqa domen orqali murojaat qilindi.",
        );
      }
      const currentUser = hasTenantBinding
        ? await this.tenantMembershipAuth.resolve(
            payload.id,
            payload.tenantId!,
            payload.membershipId!,
          )
        : await this.resolveCurrentUser(payload.id);
      if (!currentUser)
        throw new UnauthorizedException(
          "Tenant membership is no longer active",
        );
      if (
        (payload.credentialVersion ?? 0) !==
        (currentUser.credentialVersion ?? 0)
      ) {
        throw new UnauthorizedException("Credentials changed; sign in again");
      }
      if (
        tenantContext.kind === "UNREGISTERED" &&
        !hasOnlyPlatformRoles(currentUser.roles)
      ) {
        throw new ForbiddenException(
          "Restoran xodimlari faqat tasdiqlangan restoran domenidan kirishi mumkin.",
        );
      }
      request.user = currentUser;
      await this.assertDesktopDeviceEnrollment(request);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }

  private async assertDesktopDeviceEnrollment(
    request: AuthenticatedRequest,
  ): Promise<void> {
    const rawDeviceId = request.headers["x-mazetto-device-id"];
    const deviceId = Array.isArray(rawDeviceId) ? rawDeviceId[0] : rawDeviceId;
    const rawDeviceToken = request.headers["x-mazetto-device-token"];
    const deviceToken = Array.isArray(rawDeviceToken)
      ? rawDeviceToken[0]
      : rawDeviceToken;

    // Login, session refresh and the public enrollment request must remain
    // reachable so an unregistered desktop can receive its first code.
    const pathname = request.path.replace(/^\/api\/v1/, "");
    if (
      pathname === "/auth/login" ||
      pathname === "/auth/refresh" ||
      pathname === "/auth/me" ||
      pathname === "/devices/enroll"
    ) {
      return;
    }

    const normalizedDeviceId = deviceId?.trim();
    const normalizedDeviceToken = deviceToken?.trim();

    if (!normalizedDeviceId && !normalizedDeviceToken) {
      // Oddiy web va mobil web qurilma tasdiqlash talab qilmaydi. Rasmiy
      // desktop app esa device headerlarini yuboradi va pastdagi tekshiruvdan o'tadi.
      return;
    }

    if (!normalizedDeviceId || !normalizedDeviceToken) {
      throw new ForbiddenException(
        "Bu desktop qurilma hali kod bilan tasdiqlanmagan.",
      );
    }

    const device = await this.prisma.device.findUnique({
      where: { hardwareId: normalizedDeviceId },
      select: { isActive: true, enrolledAt: true, deviceAuthTokenHash: true },
    });

    if (
      !device?.isActive ||
      !device.enrolledAt ||
      !device.deviceAuthTokenHash ||
      !secureTokenMatches(device.deviceAuthTokenHash, normalizedDeviceToken)
    ) {
      throw new ForbiddenException(
        "Bu desktop qurilma hali kod bilan tasdiqlanmagan.",
      );
    }
  }

  private extractBearerToken(
    request: AuthenticatedRequest,
  ): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return undefined;
    }

    return token;
  }

  private async resolveCurrentUser(userId: string): Promise<AuthenticatedUser> {
    /*
     * Kesh (PHASE 6 H8). Ilgari bu yerda HAR so'rovda to'rt jadvalli join
     * bajarilardi, holbuki token rollarni va ruxsatlarni allaqachon olib
     * yuradi.
     *
     * Token'ning o'ziga ishonmaymiz: u 15 daqiqa yashaydi va bekor qilib
     * bo'lmaydi. 30 soniyalik kesh esa bekor qilishni deyarli darhol
     * qoldiradi, chunki xodim o'zgarganda u ANIQ tozalanadi.
     *
     * Kalit formati va TTL `UserAuthCacheService` da: guard va xodim
     * mutatsiyalaridagi bekor qilish AYNI kalitni ishlatishi shart, aks
     * holda bekor qilish jimgina ta'sirsiz qolardi.
     */
    const cached = await this.userAuthCache.read(userId);

    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
          },
        },
        roles: {
          where: {
            role: {
              isActive: true,
            },
          },
          select: {
            role: {
              select: {
                code: true,
                isBranchScoped: true,
                permissions: {
                  select: {
                    permission: {
                      select: {
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException("User is not active");
    }
    const resolved: AuthenticatedUser = {
      id: user.id,
      ...(user.email ? { email: user.email } : {}),
      ...(user.phone ? { phone: user.phone } : {}),
      credentialVersion: user.credentialVersion,
      ...(user.employee?.status === "ACTIVE"
        ? { employeeId: user.employee.id, branchId: user.employee.branchId }
        : {}),
      isGlobalScope: hasRestaurantGlobalScope(
        user.roles.map(({ role }) => role),
      ),
      roles: user.roles.map((userRole) => userRole.role.code),
      permissions: user.roles.flatMap((userRole) =>
        userRole.role.permissions.map(
          (rolePermission) => rolePermission.permission.code,
        ),
      ),
    };

    // Faol bo'lmagan foydalanuvchi yuqorida rad etilgan, ya'ni bu yerga
    // faqat haqiqiy profil yetib keladi.
    await this.userAuthCache.write(resolved);

    return resolved;
  }
}

function secureTokenMatches(expectedHash: string, token: string): boolean {
  const actual = Buffer.from(hashDeviceToken(token));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
