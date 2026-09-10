import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthenticatedRequest, AuthenticatedUser } from "../types/authenticated-user";
import { getJwtAccessSecret } from "../../config/auth.config";
import { PrismaService } from "../../prisma/prisma.service";
import { UserAuthCacheService } from "../auth/user-auth-cache.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly userAuthCache: UserAuthCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
        secret: getJwtAccessSecret(),
      });
      request.user = await this.resolveCurrentUser(payload.id);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }

  private extractBearerToken(request: AuthenticatedRequest): string | undefined {
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
      ...(user.employee?.status === "ACTIVE"
        ? { employeeId: user.employee.id, branchId: user.employee.branchId }
        : {}),
      roles: user.roles.map((userRole) => userRole.role.code),
      permissions: user.roles.flatMap((userRole) =>
        userRole.role.permissions.map((rolePermission) => rolePermission.permission.code),
      ),
    };

    // Faol bo'lmagan foydalanuvchi yuqorida rad etilgan, ya'ni bu yerga
    // faqat haqiqiy profil yetib keladi.
    await this.userAuthCache.write(resolved);

    return resolved;
  }
}
