import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  OrderStatus,
  Prisma,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  getCustomerJwtAccessExpiresIn,
  getCustomerJwtAccessSecret,
  getCustomerJwtRefreshExpiresIn,
  getCustomerJwtRefreshSecret,
} from "../../config/auth.config";
import { PrismaService } from "../../prisma/prisma.service";
import { BranchesService } from "../branches/branches.service";
import { TelegramCustomerAuthService } from "../telegram/telegram-customer-auth.service";
import { TelegramOrderNotificationService } from "../telegram/telegram-order-notification.service";
import { CustomerOrderEngineService } from "./customer-order-engine.service";
import type {
  CreateOnlineOrderDto,
  CustomerLogoutDto,
  CustomerRefreshDto,
  CustomerRequestCodeDto,
  CustomerVerifyCodeDto,
} from "./dto/customer.dto";

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
const CUSTOMER_CODE_TTL_MS = 10 * 60 * 1000;
const CUSTOMER_CODE_ATTEMPT_LIMIT = 5;
const CUSTOMER_CODE_REQUEST_WINDOW_MS = 60 * 1000;
const CUSTOMER_CODE_REQUEST_LIMIT = 3;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
    private readonly jwtService: JwtService,
    private readonly customerOrderEngine: CustomerOrderEngineService,
    private readonly telegramCustomerAuthService: TelegramCustomerAuthService,
    private readonly telegramOrderNotificationService: TelegramOrderNotificationService,
  ) {}

  async requestCode(dto: CustomerRequestCodeDto) {
    const phone = this.normalizePhone(dto.phone);
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
          expiresAt: new Date(Date.now() + CUSTOMER_CODE_TTL_MS),
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
    const phone = this.normalizePhone(dto.phone);
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

    if (challenge.attempts >= CUSTOMER_CODE_ATTEMPT_LIMIT) {
      throw new UnauthorizedException("Verification attempt limit exceeded");
    }

    const codeMatches = await bcrypt.compare(dto.code, challenge.codeHash);

    if (!codeMatches) {
      const attempts = challenge.attempts + 1;
      await this.prisma.customerVerificationChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts,
          ...(attempts >= CUSTOMER_CODE_ATTEMPT_LIMIT
            ? { consumedAt: now }
            : {}),
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

  listCategories(branchId?: string) {
    return this.prisma.category.findMany({
      where: {
        isActive: true,
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
      },
    });
  }

  listBranches() {
    return this.branchesService.listCustomerBranches();
  }

  listProducts(branchId?: string, categoryId?: string) {
    return this.prisma.product.findMany({
      where: {
        isAvailable: true,
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
        ...this.branchesService.getUnavailableProductWhere(branchId),
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: this.productInclude(),
    });
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isAvailable: true },
      include: this.productInclude(),
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return product;
  }

  getMe(customerId: string) {
    return this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        bonusBalance: true,
        createdAt: true,
      },
    });
  }

  async createOnlineOrder(customerId: string, dto: CreateOnlineOrderDto) {
    const result = await this.customerOrderEngine.createOnlineOrder(customerId, dto);

    if (result.order?.id) {
      void this.telegramOrderNotificationService.notifyNewOrder(result.order.id);
    }

    return result;
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
    const recentRequests = await tx.customerVerificationChallenge.count({
      where: {
        phone,
        createdAt: {
          gte: new Date(Date.now() - CUSTOMER_CODE_REQUEST_WINDOW_MS),
        },
      },
    });

    if (recentRequests >= CUSTOMER_CODE_REQUEST_LIMIT) {
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

  async getCustomerDashboard(customerId: string) {
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      include: {
        customerOrders: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: this.customerOrderInclude(),
        },
        favorites: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                sellingPrice: true,
              },
            },
          },
        },
      },
    });

    return {
      ...customer,
      customerOrders: customer.customerOrders.map((customerOrder) =>
        this.withDerivedCustomerOrderStatus(customerOrder),
      ),
    };
  }

  async listCustomerOrders(customerId: string) {
    const customerOrders = await this.prisma.customerOrder.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: this.customerOrderInclude({ includePayments: true }),
    });

    return customerOrders.map((customerOrder) =>
      this.withDerivedCustomerOrderStatus(customerOrder),
    );
  }

  async getCustomerOrder(customerId: string, customerOrderId: string) {
    const customerOrder = await this.prisma.customerOrder.findFirst({
      where: {
        id: customerOrderId,
        customerId,
      },
      include: this.customerOrderInclude({ includePayments: true }),
    });

    if (!customerOrder) {
      throw new NotFoundException("Customer order not found");
    }

    return this.withDerivedCustomerOrderStatus(customerOrder);
  }

  listCustomers(user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);

    return this.prisma.customer.findMany({
      where: branchId ? { customerOrders: { some: { branchId } } } : {},
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { customerOrders: true, favorites: true } },
      },
    });
  }

  async listOnlineOrders(
    requestedBranchId: string | undefined,
    user: AuthenticatedUser,
  ) {
    const branchId = resolveBranchScope(user, requestedBranchId);

    const customerOrders = await this.prisma.customerOrder.findMany({
      where: branchId ? { branchId } : {},
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        branch: true,
        order: { include: { items: true, kitchenTickets: true } },
      },
    });

    return customerOrders.map((customerOrder) =>
      this.withDerivedCustomerOrderStatus(customerOrder),
    );
  }

  async getCustomerStats(user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);
    const customerWhere = branchId
      ? { customerOrders: { some: { branchId } } }
      : {};
    const orderWhere = branchId ? { branchId } : {};
    const [customers, orders, bonus] = await Promise.all([
      this.prisma.customer.count({ where: customerWhere }),
      this.prisma.customerOrder.count({ where: orderWhere }),
      this.prisma.customer.aggregate({
        where: customerWhere,
        _sum: { bonusBalance: true },
      }),
    ]);

    return {
      customers,
      onlineOrders: orders,
      bonusLiability: bonus._sum.bonusBalance ?? new Prisma.Decimal(0),
    };
  }

  private withDerivedCustomerOrderStatus<
    T extends { order?: { status: OrderStatus } | null },
  >(customerOrder: T): T & { status: string } {
    return {
      ...customerOrder,
      status: this.toCustomerOrderStatus(
        customerOrder.order?.status ?? OrderStatus.NEW,
      ),
    };
  }

  private toCustomerOrderStatus(status: OrderStatus): string {
    if (status === OrderStatus.SERVED) {
      return "READY";
    }

    return status;
  }

  private productInclude() {
    return {
      category: { select: { id: true, code: true, name: true } },
      variants: {
        where: { isAvailable: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      modifiers: {
        where: { modifier: { isActive: true } },
        orderBy: { sortOrder: "asc" },
        include: { modifier: true },
      },
    } satisfies Prisma.ProductInclude;
  }

  private customerOrderInclude(options?: { includePayments?: boolean }) {
    return {
      branch: { select: { id: true, name: true, address: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              productName: true,
              variantName: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              modifierSnapshot: true,
              notes: true,
            },
          },
          ...(options?.includePayments
            ? {
                payments: {
                  orderBy: { createdAt: "asc" },
                  select: {
                    id: true,
                    amount: true,
                    status: true,
                    methodCode: true,
                    method: { select: { code: true, name: true } },
                  },
                },
              }
            : {}),
        },
      },
    } satisfies Prisma.CustomerOrderInclude;
  }

  private createOrderNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll("-", "");
    const time = now.toISOString().slice(11, 19).replaceAll(":", "");

    return `WEB-${date}-${time}-${randomInt(1000, 10000)}`;
  }

  private generateVerificationCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  private normalizePhone(phone: string): string {
    const normalized = phone.trim().replace(/[^\d+]/g, "");

    if (!normalized || normalized.length < 7 || normalized.length > 20) {
      throw new BadRequestException("Phone number is invalid");
    }

    return normalized.startsWith("998") ? `+${normalized}` : normalized;
  }

  private getCustomerRefreshExpiresAt(): Date {
    return new Date(Date.now() + getCustomerJwtRefreshExpiresIn() * 1000);
  }
}
