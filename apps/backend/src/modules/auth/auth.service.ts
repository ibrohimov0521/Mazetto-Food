import { HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  getJwtAccessExpiresIn,
  getJwtAccessSecret,
  getJwtRefreshExpiresIn,
  getJwtRefreshSecret,
} from "../../config/auth.config";
import { normalizeCustomerPhone } from "../customers/customer-phone";
import type { AuthResponse, AuthTokens, RefreshTokenPayload } from "./auth.types";
import type { LoginDto } from "./dto/login.dto";

type UserWithAuthRelations = {
  id: string;
  email: string | null;
  phone: string | null;
  employee: { id: string; branchId: string } | null;
  roles: {
    role: {
      code: string;
      permissions: { permission: { code: string } }[];
    };
  }[];
};

type LoginThrottleRecord = {
  failures: number;
  firstFailureAt: number;
  blockedUntil: number | null;
};

const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_THROTTLE_BLOCK_MS = 15 * 60 * 1000;
const LOGIN_THROTTLE_MAX_ADDRESS_FAILURES = 5;
const LOGIN_THROTTLE_MAX_IDENTIFIER_FAILURES = 20;
const LOGIN_THROTTLE_GC_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly loginThrottle = new Map<string, LoginThrottleRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, clientAddress = "unknown"): Promise<AuthResponse> {
    const identifier = this.normalizeIdentifier(dto.identifier);
    const throttleKeys = this.createLoginThrottleKeys(identifier, clientAddress);

    for (const throttle of throttleKeys) {
      this.assertLoginAllowed(throttle.key);
    }

    const userRecord = await this.prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [{ email: identifier }, { phone: identifier }],
      },
      include: this.userAuthInclude(),
    });

    if (!userRecord?.passwordHash) {
      this.registerFailedLogin(throttleKeys);
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatches = await compare(dto.password, userRecord.passwordHash);

    if (!passwordMatches) {
      this.registerFailedLogin(throttleKeys);
      throw new UnauthorizedException("Invalid credentials");
    }

    for (const throttle of throttleKeys) {
      this.loginThrottle.delete(throttle.key);
    }

    await this.prisma.user.update({
      where: { id: userRecord.id },
      data: { lastLoginAt: new Date() },
    });

    const user = this.toAuthenticatedUser(userRecord);

    return {
      user,
      tokens: await this.issueTokens(user),
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const tokenMatches = await compare(refreshToken, session.refreshTokenHash);

    if (!tokenMatches) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    const userRecord = await this.prisma.user.findUnique({
      where: { id: payload.id },
      include: this.userAuthInclude(),
    });

    if (!userRecord?.isActive) {
      throw new UnauthorizedException("User is not active");
    }

    const user = this.toAuthenticatedUser(userRecord);

    return {
      user,
      tokens: await this.issueTokens(user, session.id),
    };
  }

  async logout(refreshToken: string): Promise<{ revoked: boolean }> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.verifyRefreshToken(refreshToken);
    } catch {
      return { revoked: false };
    }

    await this.prisma.session.updateMany({
      where: {
        id: payload.sessionId,
        userId: payload.id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { revoked: true };
  }

  private async issueTokens(
    user: AuthenticatedUser,
    existingSessionId?: string,
  ): Promise<AuthTokens> {
    const sessionId =
      existingSessionId ??
      (
        await this.prisma.session.create({
          data: {
            userId: user.id,
            refreshTokenHash: "pending",
            expiresAt: this.getRefreshExpiresAt(),
          },
          select: { id: true },
        })
      ).id;
    const refreshPayload: RefreshTokenPayload = {
      ...user,
      sessionId,
      tokenUse: "refresh",
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(user, {
        secret: getJwtAccessSecret(),
        expiresIn: getJwtAccessExpiresIn(),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: getJwtRefreshSecret(),
        expiresIn: getJwtRefreshExpiresIn(),
      }),
    ]);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: await hash(refreshToken, 12),
        expiresAt: this.getRefreshExpiresAt(),
        revokedAt: null,
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
    };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: getJwtRefreshSecret(),
      });

      if (payload.tokenUse !== "refresh") {
        throw new UnauthorizedException("Invalid refresh token");
      }

      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  private toAuthenticatedUser(user: UserWithAuthRelations): AuthenticatedUser {
    return {
      id: user.id,
      ...(user.email ? { email: user.email } : {}),
      ...(user.phone ? { phone: user.phone } : {}),
      ...(user.employee ? { employeeId: user.employee.id, branchId: user.employee.branchId } : {}),
      roles: user.roles.map((userRole) => userRole.role.code),
      permissions: user.roles.flatMap((userRole) =>
        userRole.role.permissions.map((rolePermission) => rolePermission.permission.code),
      ),
    };
  }

  private userAuthInclude() {
    return {
      employee: true,
      roles: {
        where: {
          role: {
            isActive: true,
          },
        },
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    } as const;
  }

  private normalizeIdentifier(value: string): string {
    const trimmed = value.trim();

    if (trimmed.includes("@")) {
      return trimmed.toLowerCase();
    }

    try {
      return normalizeCustomerPhone(trimmed);
    } catch {
      return trimmed;
    }
  }

  private getRefreshExpiresAt(): Date {
    return new Date(Date.now() + getJwtRefreshExpiresIn() * 1000);
  }

  private createLoginThrottleKeys(identifier: string, clientAddress: string): LoginThrottleKey[] {
    return [
      {
        key: `login:${identifier}:address:${clientAddress}`,
        maxFailures: LOGIN_THROTTLE_MAX_ADDRESS_FAILURES,
      },
      {
        key: `login:${identifier}:account`,
        maxFailures: LOGIN_THROTTLE_MAX_IDENTIFIER_FAILURES,
      },
    ];
  }

  private assertLoginAllowed(key: string): void {
    const record = this.loginThrottle.get(key);
    const now = Date.now();

    if (!record) {
      return;
    }

    if (record.blockedUntil && record.blockedUntil > now) {
      throw new HttpException(
        "Too many login attempts. Please wait before trying again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (record.blockedUntil || now - record.firstFailureAt > LOGIN_THROTTLE_GC_MS) {
      this.loginThrottle.delete(key);
    }
  }

  private registerFailedLogin(throttles: LoginThrottleKey[]): void {
    for (const throttle of throttles) {
      this.registerFailedLoginKey(throttle);
    }
  }

  private registerFailedLoginKey(throttle: LoginThrottleKey): void {
    const now = Date.now();
    const key = throttle.key;
    const current = this.loginThrottle.get(key);
    const record =
      current && now - current.firstFailureAt <= LOGIN_THROTTLE_WINDOW_MS
        ? current
        : { failures: 0, firstFailureAt: now, blockedUntil: null };

    record.failures += 1;
    record.blockedUntil =
      record.failures >= throttle.maxFailures ? now + LOGIN_THROTTLE_BLOCK_MS : null;

    this.loginThrottle.set(key, record);
  }
}

type LoginThrottleKey = {
  key: string;
  maxFailures: number;
};
