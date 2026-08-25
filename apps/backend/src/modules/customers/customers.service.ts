import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  CustomerOrderType,
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  OrderType,
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
import { KitchenService } from "../kitchen/kitchen.service";
import { OrdersService } from "../orders/orders.service";
import { TelegramOrderNotificationService } from "../telegram/telegram-order-notification.service";
import type {
  CreateOnlineOrderDto,
  CustomerLogoutDto,
  CustomerRefreshDto,
  CustomerRequestCodeDto,
  CustomerVerifyCodeDto,
  OnlineOrderItemDto,
  OnlineOrderModifierDto,
} from "./dto/customer.dto";
import { OnlineOrderTypeDto } from "./dto/customer.dto";

type TransactionClient = Prisma.TransactionClient;
type ModifierSnapshot = {
  id: string;
  code: string;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};
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

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenService: KitchenService,
    private readonly jwtService: JwtService,
    private readonly ordersService: OrdersService,
    private readonly telegramOrderNotificationService: TelegramOrderNotificationService,
  ) {}

  async requestCode(dto: CustomerRequestCodeDto) {
    const phone = this.normalizePhone(dto.phone);
    const code = this.generateVerificationCode();
    const existingCustomer = await this.prisma.customer.findUnique({
      where: { phone },
      select: { id: true },
    });
    const challenge = await this.prisma.customerVerificationChallenge.create({
      data: {
        customerId: existingCustomer?.id ?? null,
        phone,
        codeHash: await bcrypt.hash(code, 12),
        expiresAt: new Date(Date.now() + CUSTOMER_CODE_TTL_MS),
      },
      select: { id: true, phone: true, expiresAt: true, createdAt: true },
    });

    return {
      challenge,
      delivery: {
        channel: "TELEGRAM",
        status: "PENDING_INTEGRATION",
        message:
          "Verification code delivery is reserved for the MAZETTO Telegram bot integration.",
      },
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
        name: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
      },
    });
  }

  listBranches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, address: true, phone: true },
    });
  }

  listProducts(branchId?: string, categoryId?: string) {
    return this.prisma.product.findMany({
      where: {
        isAvailable: true,
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
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
    let kitchenTicket: Awaited<
      ReturnType<KitchenService["createTicketForOrder"]>
    > | null = null;
    const result = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      const branch = await tx.branch.findFirst({
        where: { id: dto.branchId, isActive: true },
      });

      if (!branch) {
        throw new NotFoundException("Branch not found");
      }

      if (dto.type === OnlineOrderTypeDto.DELIVERY && !dto.address) {
        throw new BadRequestException("Delivery address is required");
      }

      const order = await tx.order.create({
        data: {
          branchId: dto.branchId,
          orderNumber: this.createOrderNumber(),
          source: OrderSource.WEB,
          type:
            dto.type === OnlineOrderTypeDto.DELIVERY
              ? OrderType.DELIVERY
              : OrderType.TAKEAWAY,
          status: OrderStatus.NEW,
          customerName: dto.name ?? customer.name,
          customerPhone: customer.phone,
          deliveryAddress: dto.address ?? null,
          notes: dto.notes ?? null,
          kitchenComment:
            dto.type === OnlineOrderTypeDto.DELIVERY
              ? `Delivery: ${dto.address}`
              : "Pickup order",
        },
      });

      for (const item of dto.items) {
        const snapshot = await this.createItemSnapshot(tx, dto.branchId, item);
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            variantId: item.variantId ?? null,
            productName: snapshot.productName,
            variantName: snapshot.variantName ?? null,
            quantity: snapshot.quantity,
            unitPrice: snapshot.unitPrice,
            totalPrice: snapshot.totalPrice,
            modifierSnapshot: snapshot.modifiers,
            notes: item.notes ?? null,
          },
        });
      }

      await this.recalculateOrderTotals(tx, order.id);
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          toStatus: OrderStatus.NEW,
          reason: "Online order created",
        },
      });

      const confirmed = await this.ordersService.confirmOrderForPreparation(
        tx,
        {
          orderId: order.id,
          reason: "Online order accepted for preparation",
        },
      );

      const customerOrder = await tx.customerOrder.create({
        data: {
          customerId,
          branchId: dto.branchId,
          orderId: order.id,
          type:
            dto.type === OnlineOrderTypeDto.DELIVERY
              ? CustomerOrderType.DELIVERY
              : CustomerOrderType.PICKUP,
          paymentMethod: dto.paymentMethod,
          deliveryAddress: dto.address ?? null,
          notes: dto.notes ?? null,
        },
      });

      kitchenTicket = confirmed.kitchenTicket;
      const operationalOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true, kitchenTickets: true },
      });

      return {
        customerOrder: this.withDerivedCustomerOrderStatus({
          ...customerOrder,
          order: operationalOrder,
        }),
        order: operationalOrder,
      };
    });

    this.kitchenService.emitOrderCreated(result.order);
    this.kitchenService.emitOrderConfirmed(result.order);

    if (kitchenTicket) {
      this.kitchenService.emitOrderSentToKitchen(kitchenTicket);
    }

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
          include: { order: { include: { items: true } } },
        },
        favorites: { include: { product: true } },
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
      include: {
        order: {
          include: { items: true, payments: { include: { method: true } } },
        },
      },
    });

    return customerOrders.map((customerOrder) =>
      this.withDerivedCustomerOrderStatus(customerOrder),
    );
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

  private async createItemSnapshot(
    tx: TransactionClient,
    branchId: string,
    dto: OnlineOrderItemDto,
  ) {
    const product = await tx.product.findFirst({
      where: {
        id: dto.productId,
        isAvailable: true,
        OR: [{ branchId }, { branchId: null }],
      },
      include: { variants: true },
    });

    if (!product) {
      throw new NotFoundException("Product not found or unavailable");
    }

    const variant = dto.variantId
      ? product.variants.find(
          (candidate) =>
            candidate.id === dto.variantId && candidate.isAvailable,
        )
      : product.variants.find(
          (candidate) => candidate.isDefault && candidate.isAvailable,
        );

    if (dto.variantId && !variant) {
      throw new NotFoundException("Product variant not found or unavailable");
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    const unitPrice = variant?.sellingPrice ?? product.sellingPrice;
    const modifiers = await this.createModifierSnapshot(
      tx,
      product.id,
      dto.modifiers ?? [],
    );

    return {
      productName: product.name,
      variantName: variant?.name,
      quantity,
      unitPrice,
      totalPrice: unitPrice.add(this.modifierTotal(modifiers)).mul(quantity),
      modifiers,
    };
  }

  private async createModifierSnapshot(
    tx: TransactionClient,
    productId: string,
    modifiers: OnlineOrderModifierDto[],
  ): Promise<ModifierSnapshot[]> {
    if (!modifiers.length) {
      return [];
    }

    const modifierIds = [
      ...new Set(modifiers.map((modifier) => modifier.modifierId)),
    ];
    const productModifiers = await tx.productModifier.findMany({
      where: {
        productId,
        modifierId: { in: modifierIds },
        modifier: { isActive: true },
      },
      include: { modifier: true },
    });

    return modifiers.map((selected) => {
      const productModifier = productModifiers.find(
        (candidate) => candidate.modifierId === selected.modifierId,
      );

      if (!productModifier) {
        throw new BadRequestException(
          "Modifier is not available for this product",
        );
      }

      const quantity = new Prisma.Decimal(selected.quantity ?? 1);
      const totalPrice = productModifier.modifier.price.mul(quantity);

      return {
        id: productModifier.modifier.id,
        code: productModifier.modifier.code,
        name: productModifier.modifier.name,
        quantity: quantity.toFixed(3),
        unitPrice: productModifier.modifier.price.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
      };
    });
  }

  private modifierTotal(modifiers: ModifierSnapshot[]) {
    return modifiers.reduce(
      (total, modifier) => total.add(new Prisma.Decimal(modifier.totalPrice)),
      new Prisma.Decimal(0),
    );
  }

  private async recalculateOrderTotals(
    tx: TransactionClient,
    orderId: string,
  ): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: { orderId, status: OrderItemStatus.ACTIVE },
      select: { totalPrice: true },
    });
    const subtotal = items.reduce(
      (total, item) => total.add(item.totalPrice),
      new Prisma.Decimal(0),
    );

    await tx.order.update({
      where: { id: orderId },
      data: { subtotal, total: subtotal },
    });
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
      category: { select: { id: true, name: true } },
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
