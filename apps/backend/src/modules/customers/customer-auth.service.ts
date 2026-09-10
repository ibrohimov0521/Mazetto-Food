import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import {
  getCustomerJwtAccessExpiresIn,
  getCustomerJwtAccessSecret,
  getCustomerJwtRefreshExpiresIn,
  getCustomerJwtRefreshSecret,
} from "../../config/auth.config";
import { PrismaService } from "../../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { TelegramCustomerAuthService } from "../telegram/telegram-customer-auth.service";
import { normalizeCustomerPhone } from "./customer-phone";
import type {
  CustomerLogoutDto,
  CustomerRefreshDto,
  CustomerRequestCodeDto,
  CustomerVerifyCodeDto,
} from "./dto/customer.dto";

/*
 * Mijoz AUTENTIFIKATSIYASI: kod so'rash, tasdiqlash, token yangilash,
 * chiqish.
 *
 * NIMA UCHUN AJRATILDI. `customers.service.ts` uchta mustaqil domenni
 * bitta klassda saqlardi: autentifikatsiya, mijoz katalogi va kuryer.
 * Bu blok ularning hech biriga bog'liq emas — u faqat Prisma, JWT,
 * sozlamalar va Telegram yetkazib berishga qaraydi.
 *
 * Cheklov qiymatlari SOZLAMA REESTRIDAN o'qiladi (7-bosqich Q1):
 * ilgari ular shu faylda VA `telegram-customer-auth.service.ts` da
 * takrorlangan edi va biri o'zgartirilsa ikkinchisi ortda qolardi.
 */

type TransactionClient = Prisma.TransactionClient;

type CustomerAccessPayload = {
  id: string;
  phone: string;
  tokenUse: "customer_access";
};

type CustomerRefreshPayload = {
  id: string;
  phone: string;
  sessionId: string;
  tokenUse: "customer_refresh";
};

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly telegramCustomerAuthService: TelegramCustomerAuthService,
    private readonly settingsService: SettingsService,
  ) {}

  async requestCode(dto: CustomerRequestCodeDto) {
    const phone = normalizeCustomerPhone(dto.phone);
    const ttlMinutes = await this.settingsService.getInt(
      "customer_code_ttl_minutes",
    );
    const code = this.generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 12);
    const challenge = await this.prisma.$transaction(async (tx) => {
      await this.assertCanRequestCode(tx, phone);
      const existingCustomer = await tx.customer.findUnique({
        where: { phone },
        select: { id: true },
      });

      await this.expireActiveCustomerChallenges(tx, phone);

      return tx.customerVerificationChallenge.create({
        data: {
          customerId: existingCustomer?.id ?? null,
          phone,
          codeHash,
          expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
        },
        select: { id: true, phone: true, expiresAt: true, createdAt: true },
      });
    });

    const delivery =
      await this.telegramCustomerAuthService.deliverVerificationCode({
        phone,
        code,
      });

    return {
      challenge,
      delivery,
    };
  }

  async verifyCode(dto: CustomerVerifyCodeDto) {
    const phone = normalizeCustomerPhone(dto.phone);
    const now = new Date();
    const challenge = await this.prisma.customerVerificationChallenge.findFirst(
      {
        where: {
          phone,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
      },
    );

    if (!challenge) {
      throw new UnauthorizedException("Invalid or expired verification code");
    }

    const attemptLimit = await this.settingsService.getInt(
      "customer_code_attempt_limit",
    );

    if (challenge.attempts >= attemptLimit) {
      throw new UnauthorizedException("Verification attempt limit exceeded");
    }

    const codeMatches = await bcrypt.compare(dto.code, challenge.codeHash);

    if (!codeMatches) {
      const attempts = challenge.attempts + 1;
      await this.prisma.customerVerificationChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts,
          ...(attempts >= attemptLimit ? { consumedAt: now } : {}),
        },
      });
      throw new UnauthorizedException("Invalid or expired verification code");
    }

    const customer = await this.prisma.customer.upsert({
      where: { phone },
      update: {
        ...(dto.name ? { name: dto.name } : {}),
      },
      create: {
        name: dto.name ?? phone,
        phone,
      },
    });

    await this.prisma.customerVerificationChallenge.update({
      where: { id: challenge.id },
      data: {
        customerId: customer.id,
        consumedAt: now,
      },
    });

    return {
      customer,
      tokens: await this.issueCustomerTokens(customer),
    };
  }

  async refresh(dto: CustomerRefreshDto) {
    const payload = await this.verifyCustomerRefreshToken(dto.refreshToken);
    const session = await this.prisma.customerSession.findFirst({
      where: {
        id: payload.sessionId,
        customerId: payload.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const tokenMatches = await bcrypt.compare(
      dto.refreshToken,
      session.refreshTokenHash,
    );

    if (!tokenMatches) {
      await this.prisma.customerSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: payload.id },
    });

    if (!customer) {
      throw new UnauthorizedException("Customer not found");
    }

    return {
      customer,
      tokens: await this.issueCustomerTokens(customer, session.id),
    };
  }

  async logout(dto: CustomerLogoutDto) {
    try {
      const payload = await this.verifyCustomerRefreshToken(dto.refreshToken);
      await this.prisma.customerSession.updateMany({
        where: {
          id: payload.sessionId,
          customerId: payload.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      return { revoked: true };
    } catch {
      return { revoked: false };
    }
  }

  private async issueCustomerTokens(
    customer: { id: string; phone: string },
    existingSessionId?: string,
  ) {
    const sessionId =
      existingSessionId ??
      (
        await this.prisma.customerSession.create({
          data: {
            customerId: customer.id,
            refreshTokenHash: "pending",
            expiresAt: this.getCustomerRefreshExpiresAt(),
          },
          select: { id: true },
        })
      ).id;
    const accessPayload: CustomerAccessPayload = {
      id: customer.id,
      phone: customer.phone,
      tokenUse: "customer_access",
    };
    const refreshPayload: CustomerRefreshPayload = {
      id: customer.id,
      phone: customer.phone,
      sessionId,
      tokenUse: "customer_refresh",
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: getCustomerJwtAccessSecret(),
        expiresIn: getCustomerJwtAccessExpiresIn(),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: getCustomerJwtRefreshSecret(),
        expiresIn: getCustomerJwtRefreshExpiresIn(),
      }),
    ]);

    await this.prisma.customerSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: await bcrypt.hash(refreshToken, 12),
        expiresAt: this.getCustomerRefreshExpiresAt(),
        revokedAt: null,
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
    };
  }

  private async assertCanRequestCode(
    tx: TransactionClient,
    phone: string,
  ): Promise<void> {
    const [windowSeconds, requestLimit] = await Promise.all([
      this.settingsService.getInt("customer_code_request_window_seconds"),
      this.settingsService.getInt("customer_code_request_limit"),
    ]);
    const recentRequests = await tx.customerVerificationChallenge.count({
      where: {
        phone,
        createdAt: {
          gte: new Date(Date.now() - windowSeconds * 1000),
        },
      },
    });

    if (recentRequests >= requestLimit) {
      throw new BadRequestException(
        "Too many verification code requests. Please wait before trying again.",
      );
    }
  }

  private async expireActiveCustomerChallenges(
    tx: TransactionClient,
    phone: string,
  ): Promise<void> {
    const now = new Date();

    await tx.customerVerificationChallenge.updateMany({
      where: {
        phone,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
  }

  private async verifyCustomerRefreshToken(
    refreshToken: string,
  ): Promise<CustomerRefreshPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<CustomerRefreshPayload>(
        refreshToken,
        {
          secret: getCustomerJwtRefreshSecret(),
        },
      );

      if (payload.tokenUse !== "customer_refresh") {
        throw new UnauthorizedException("Invalid refresh token");
      }

      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  private generateVerificationCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  private getCustomerRefreshExpiresAt(): Date {
    return new Date(Date.now() + getCustomerJwtRefreshExpiresIn() * 1000);
  }
}
