import { syncKitchenTickets } from "../kitchen/kitchen-status-sync";
import { KitchenService } from "../kitchen/kitchen.service";
import {
  kitchenEvents,
  kitchenOrderStatusChangedEvent,
} from "../kitchen/kitchen-events";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OrderStatus, Prisma } from "@prisma/client";
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
import { SettingsService } from "../settings/settings.service";
import { CustomerOrderEngineService } from "./customer-order-engine.service";
import {
  ListCustomerOrdersDto,
  ListCustomersDto,
  ListOnlineOrdersDto,
  UpdateCourierOrderStatusDto,
} from "./dto/list-customers.dto";
import {
  customerVisibleCategoryCodes,
  customerVisibleProductCodes,
} from "./customer-catalog-visibility";
import { normalizeCustomerPhone } from "./customer-phone";
import { deliveryDistanceKm } from "./delivery-distance";
import type {
  CustomerCheckoutQuoteDto,
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
/*
 * Tasdiqlash kodi cheklovlari SOZLAMA REESTRIDA (7-bosqich Q1).
 *
 * Ilgari bu qiymatlar shu faylda VA `telegram-customer-auth.service.ts` da takrorlangan edi: biri
 * o'zgartirilsa ikkinchisi ortda qolardi va hech narsa ogohlantirmasdi.
 * Endi ikkala yo'l ham bitta manbadan o'qiydi va o'zgarish deploysiz
 * qo'llanadi.
 */

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
    private readonly kitchenService: KitchenService,
    private readonly jwtService: JwtService,
    private readonly customerOrderEngine: CustomerOrderEngineService,
    private readonly telegramCustomerAuthService: TelegramCustomerAuthService,
    private readonly telegramOrderNotificationService: TelegramOrderNotificationService,
    private readonly settingsService: SettingsService,
  ) {}

  async requestCode(dto: CustomerRequestCodeDto) {
    const phone = normalizeCustomerPhone(dto.phone);
    const ttlMinutes = await this.settingsService.getInt("customer_code_ttl_minutes");
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
          ...(attempts >= attemptLimit
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
        code: { in: [...customerVisibleCategoryCodes] },
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
        code: { in: [...customerVisibleProductCodes] },
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
      where: {
        id,
        isAvailable: true,
        code: { in: [...customerVisibleProductCodes] },
      },
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
    const result = await this.customerOrderEngine.createOnlineOrder(
      customerId,
      dto,
    );

    if (result.order?.id) {
      void this.telegramOrderNotificationService.notifyNewOrder(
        result.order.id,
      );
    }

    return result;
  }

  quoteCheckout(customerId: string, dto: CustomerCheckoutQuoteDto) {
    return this.customerOrderEngine.quoteCheckout(customerId, dto);
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

  /*
   * Mijoz buyurtmalari tarixi.
   *
   * MUAMMO (PHASE 6 H10). Ilgari bu yerda `take` yo'q edi va har chaqiruv
   * mijozning BUTUN tarixini ichki `items`/`payments` bilan tortardi. Tarix
   * biznes hajmi bilan cheksiz o'sadi, `/orders` sahifasi esa buyurtma
   * holati o'zgarganda uni qayta yuklaydi — ya'ni eng sodiq mijozning
   * so'rovi eng og'iri bo'lardi.
   *
   * Javob shakli ATAYLAB o'zgarmadi (hamon massiv): `customer-web`
   * `CustomerOrder[]` kutadi va bu tuzatish uni buzmasligi kerak. To'liq
   * sahifalash konverti keyingi ish.
   */
  async listCustomerOrders(customerId: string, query: ListCustomerOrdersDto) {
    const customerOrders = await this.prisma.customerOrder.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
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

  listCustomers(query: ListCustomersDto, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);

    return this.prisma.customer.findMany({
      where: branchId ? { customerOrders: { some: { branchId } } } : {},
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
      include: {
        _count: { select: { customerOrders: true, favorites: true } },
      },
    });
  }

  async listOnlineOrders(query: ListOnlineOrdersDto, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user, query.branchId);

    const customerOrders = await this.prisma.customerOrder.findMany({
      where: branchId ? { branchId } : {},
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
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

  async listCourierDeliveryOrders(
    query: ListOnlineOrdersDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = this.requireEmployee(user);
    const branchId = resolveBranchScope(user, query.branchId);
    const day = this.todayTashkentRange();
    const status = this.toOrderStatus(query.status);
    const search = query.search?.trim();

    const orderFilters: Prisma.OrderWhereInput[] = [
      { OR: [{ servedById: null }, { servedById: employeeId }] },
    ];
    if (search) {
      orderFilters.push(this.buildOrderSearchWhere(search));
    }

    const customerOrders = await this.prisma.customerOrder.findMany({
      where: {
        type: "DELIVERY",
        ...(branchId ? { branchId } : {}),
        order: {
          createdAt: { gte: day.start, lt: day.end },
          status: status ?? { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
          AND: orderFilters,
        },
      },
      orderBy: { createdAt: "asc" },
      skip: query.offset,
      take: query.limit,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
        order: {
          include: {
            items: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                productName: true,
                quantity: true,
                totalPrice: true,
              },
            },
          },
        },
      },
    });

    return customerOrders.map((customerOrder) =>
      this.withDeliveryDistance(this.withDerivedCustomerOrderStatus(customerOrder)),
    );
  }

  async listCourierDeliveryOrderHistory(
    query: ListOnlineOrdersDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = this.requireEmployee(user);
    const branchId = resolveBranchScope(user, query.branchId);
    const day = this.todayTashkentRange();
    const status = this.toOrderStatus(query.status);
    const search = query.search?.trim();

    const customerOrders = await this.prisma.customerOrder.findMany({
      where: {
        type: "DELIVERY",
        ...(branchId ? { branchId } : {}),
        order: {
          servedById: employeeId,
          createdAt: { gte: day.start, lt: day.end },
          ...(status ? { status } : {}),
          ...(search ? this.buildOrderSearchWhere(search) : {}),
          statusHistory: {
            some: {
              changedByEmployeeId: employeeId,
              createdAt: { gte: day.start, lt: day.end },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: query.offset,
      take: query.limit,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
        order: {
          include: {
            items: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                productName: true,
                quantity: true,
                totalPrice: true,
              },
            },
          },
        },
      },
    });

    return customerOrders.map((customerOrder) =>
      this.withDeliveryDistance(this.withDerivedCustomerOrderStatus(customerOrder)),
    );
  }

  async updateCourierOrderStatus(
    customerOrderId: string,
    dto: UpdateCourierOrderStatusDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = this.requireEmployee(user);
    const scopedBranchId = resolveBranchScope(user);
    const nextStatus = dto.status as OrderStatus;

    const customerOrder = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT o.id FROM "orders" o JOIN "customer_orders" c ON c."orderId" = o.id WHERE c.id = ${customerOrderId} FOR UPDATE OF o`;
      const existing = await tx.customerOrder.findUnique({
        where: { id: customerOrderId },
        include: { order: true },
      });

      if (!existing) {
        throw new NotFoundException("Online order not found");
      }

      if (existing.type !== "DELIVERY") {
        throw new BadRequestException(
          "Only delivery orders can be updated by courier",
        );
      }

      if (scopedBranchId && existing.branchId !== scopedBranchId) {
        throw new ForbiddenException("Cannot access another branch");
      }

      if (
        existing.order.status === OrderStatus.COMPLETED ||
        existing.order.status === OrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          "Completed or cancelled orders cannot change status",
        );
      }

      if (
        existing.order.servedById &&
        existing.order.servedById !== employeeId
      ) {
        throw new ForbiddenException("Bu buyurtmani boshqa kuryer olib ketgan.");
      }

      if (existing.order.status !== nextStatus) {
        if (existing.order.status === OrderStatus.SERVED && nextStatus === OrderStatus.READY) {
          throw new BadRequestException("Yo'ldagi buyurtmani tayyor holatiga qaytarib bo'lmaydi.");
        }
        if (
          nextStatus !== OrderStatus.CANCELLED &&
          existing.order.status !== OrderStatus.READY &&
          existing.order.status !== OrderStatus.SERVED
        ) {
          throw new BadRequestException(
            "Buyurtma hali oshxonada tayyor bo'lmagan.",
          );
        }
        await tx.order.update({
          where: { id: existing.orderId },
          data: {
            status: nextStatus,
            ...(nextStatus === OrderStatus.SERVED ||
            nextStatus === OrderStatus.COMPLETED
              ? { servedBy: { connect: { id: employeeId } } }
              : {}),
            ...(nextStatus === OrderStatus.COMPLETED
              ? {
                  closedAt: new Date(),
                  closedBy: { connect: { id: employeeId } },
                }
              : {}),
            ...(nextStatus === OrderStatus.CANCELLED
              ? {
                  cancelledAt: new Date(),
                  cancellationReason: "Courier cancelled delivery",
                  cancelledBy: { connect: { id: employeeId } },
                }
              : {}),
          },
        });

        await syncKitchenTickets(tx, existing.orderId, nextStatus);
        await tx.orderStatusHistory.create({
          data: {
            orderId: existing.orderId,
            fromStatus: existing.order.status,
            toStatus: nextStatus,
            changedByUserId: user.id,
            changedByEmployeeId: user.employeeId ?? null,
            reason: `Courier status requested: ${dto.status}`,
          },
        });
      }

      return tx.customerOrder.findUniqueOrThrow({
        where: { id: customerOrderId },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          branch: {
            select: {
              id: true,
              name: true,
              address: true,
              latitude: true,
              longitude: true,
            },
          },
          order: {
            include: {
              items: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  productName: true,
                  quantity: true,
                  totalPrice: true,
                },
              },
            },
          },
        },
      });
    });

    this.kitchenService.emitOrderStatusChanged({ orderId: customerOrder.orderId });
    kitchenEvents.emit(kitchenOrderStatusChangedEvent, {
      orderId: customerOrder.orderId,
      action: "refresh",
    });
    return this.withDerivedCustomerOrderStatus(customerOrder);
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

  /*
   * Kuryer ro'yxatiga filialdan mijozgacha masofa qo'shadi.
   *
   * ATAYLAB SARALAMAYMIZ. Masofa `deliveryLocation` JSON ustunidan
   * hisoblanadi, ya'ni SQL uni bilmaydi va saralash faqat joriy SAHIFA
   * ichida bo'lardi — "eng yaqin buyurtma" ro'yxat boshida turgandek
   * ko'rinib, aslida keyingi sahifada qolib ketardi. Bu haqiqatdan ham
   * yomonroq: noto'g'ri tartib to'g'ri tartibdek ko'rinadi.
   *
   * Masofa hozircha KO'RSATISH uchun. Haqiqiy "eng yaqin birinchi"
   * tartibi uchun koordinatalar alohida ustunlarga chiqarilishi kerak.
   */
  private withDeliveryDistance<
    T extends {
      deliveryLocation?: unknown;
      branch?: {
        latitude: Prisma.Decimal | null;
        longitude: Prisma.Decimal | null;
      } | null;
    },
  >(customerOrder: T): T & { distanceKm: number | null } {
    return {
      ...customerOrder,
      distanceKm: customerOrder.branch
        ? deliveryDistanceKm(customerOrder.branch, customerOrder.deliveryLocation)
        : null,
    };
  }

  private toCustomerOrderStatus(status: OrderStatus): string {
    if (status === OrderStatus.SERVED) {
      return "READY";
    }

    return status;
  }

  private buildOrderSearchWhere(search: string): Prisma.OrderWhereInput {
    return {
      OR: [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { displayOrderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
        { deliveryAddress: { contains: search, mode: "insensitive" } },
        { items: { some: { productName: { contains: search, mode: "insensitive" } } } },
      ],
    };
  }

  private toOrderStatus(status?: string): OrderStatus | undefined {
    return Object.values(OrderStatus).includes(status as OrderStatus)
      ? (status as OrderStatus)
      : undefined;
  }

  private requireEmployee(user: AuthenticatedUser): string {
    if (!user.employeeId) {
      throw new ForbiddenException("Authenticated user is not linked to an employee");
    }

    return user.employeeId;
  }

  /*
   * Kuryerlar nazorati (5.5).
   *
   * Ilgari hech kim kim nima olib ketayotganini KO'RA OLMASDI: kuryer
   * buyurtmani o'zi olardi (birinchi kelgan oladi) va agar telefoni
   * o'chsa yoki kasal bo'lib qolsa, buyurtma o'sha kuryerga biriktirilgan
   * holda muzlab qolardi — chunki `updateCourierOrderStatus` boshqa
   * kuryerni rad etadi.
   */
  async listCouriers(user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);
    const day = this.todayTashkentRange();

    const couriers = await this.prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        ...(branchId ? { branchId } : {}),
        user: { roles: { some: { role: { code: "COURIER" } } } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        employeeCode: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    if (!couriers.length) {
      return [];
    }

    /*
     * Ikkita `groupBy` — kuryer boshiga alohida so'rov emas.
     * 20 ta kuryerda bu 40 ta so'rovni 2 taga tushiradi.
     */
    const courierIds = couriers.map((courier) => courier.id);
    const [active, completed] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["servedById"],
        where: {
          servedById: { in: courierIds },
          type: "DELIVERY",
          status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
        },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ["servedById"],
        where: {
          servedById: { in: courierIds },
          type: "DELIVERY",
          status: OrderStatus.COMPLETED,
          // "Bugun" Toshkent bo'yicha — UTC yarim tunda hisob nolga tushmasin.
          updatedAt: { gte: day.start, lt: day.end },
        },
        _count: { _all: true },
      }),
    ]);

    const activeById = new Map(
      active.map((row) => [row.servedById, row._count._all]),
    );
    const completedById = new Map(
      completed.map((row) => [row.servedById, row._count._all]),
    );

    return couriers.map((courier) => ({
      ...courier,
      activeDeliveries: activeById.get(courier.id) ?? 0,
      completedToday: completedById.get(courier.id) ?? 0,
    }));
  }

  /*
   * Nazorat ekrani uchun FAOL yetkazishlar.
   *
   * Nima uchun `/online-orders` ni qayta ishlatmadik: u barcha turdagi
   * buyurtmalarni to'liq `items` va `kitchenTickets` bilan tortadi. Kunlik
   * hajm chegaradan oshganda yetkazishlar olib ketishlar orasida qolib
   * ketardi — ya'ni nazorat ekrani buyurtmani KO'RSATMASDAN qoldirardi,
   * bu esa uning butun maqsadini yo'qqa chiqaradi.
   *
   * Bu yerda filtr SERVERDA va faqat kerakli maydonlar olinadi.
   */
  async listActiveDeliveries(user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);

    const customerOrders = await this.prisma.customerOrder.findMany({
      where: {
        type: "DELIVERY",
        ...(branchId ? { branchId } : {}),
        order: {
          status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        deliveryAddress: true,
        deliveryLocation: true,
        createdAt: true,
        customer: { select: { id: true, name: true, phone: true } },
        branch: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            displayOrderNumber: true,
            status: true,
            total: true,
            servedById: true,
          },
        },
      },
    });

    return customerOrders.map((customerOrder) =>
      this.withDeliveryDistance(this.withDerivedCustomerOrderStatus(customerOrder)),
    );
  }

  /**
   * Buyurtmani kuryerga biriktiradi yoki biriktirishni bekor qiladi
   * (`employeeId: null` — buyurtma yana "erkin" bo'ladi).
   */
  async assignCourier(
    customerOrderId: string,
    employeeId: string | null,
    user: AuthenticatedUser,
  ) {
    const scopedBranchId = resolveBranchScope(user);

    return this.prisma.$transaction(async (tx) => {
      /*
       * `FOR UPDATE` — kuryerning o'zi shu lahzada buyurtmani olayotgan
       * bo'lishi mumkin (`updateCourierOrderStatus` ham shu qulfni oladi).
       * Qulfsiz ikkalasi ham muvaffaqiyatli tugab, oxirgi yozuv yutardi.
       */
      await tx.$queryRaw`SELECT o.id FROM "orders" o JOIN "customer_orders" c ON c."orderId" = o.id WHERE c.id = ${customerOrderId} FOR UPDATE OF o`;

      const existing = await tx.customerOrder.findUnique({
        where: { id: customerOrderId },
        include: { order: { select: { id: true, status: true } } },
      });

      if (!existing) {
        throw new NotFoundException("Online order not found");
      }
      if (existing.type !== "DELIVERY") {
        throw new BadRequestException(
          "Faqat yetkazish buyurtmasini kuryerga biriktirish mumkin.",
        );
      }
      if (scopedBranchId && existing.branchId !== scopedBranchId) {
        throw new ForbiddenException("Cannot access another branch");
      }
      if (
        existing.order.status === OrderStatus.COMPLETED ||
        existing.order.status === OrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          "Yakunlangan yoki bekor qilingan buyurtmani qayta biriktirib bo'lmaydi.",
        );
      }

      if (employeeId) {
        /*
         * Biriktirilayotgan xodim HAQIQATAN kuryer va SHU filialda ekanini
         * tekshiramiz — aks holda buyurtma oshpazga biriktirilib, kuryer
         * ro'yxatidan butunlay yo'qolib ketardi.
         */
        const courier = await tx.employee.findFirst({
          where: {
            id: employeeId,
            status: "ACTIVE",
            branchId: existing.branchId,
            user: { roles: { some: { role: { code: "COURIER" } } } },
          },
          select: { id: true },
        });

        if (!courier) {
          throw new BadRequestException(
            "Bu xodim shu filialning faol kuryeri emas.",
          );
        }
      }

      await tx.order.update({
        where: { id: existing.order.id },
        data: { servedById: employeeId },
      });

      return { customerOrderId, employeeId };
    });
  }

  private todayTashkentRange(): { start: Date; end: Date } {
    const offsetMs = 5 * 60 * 60 * 1000;
    const shifted = new Date(Date.now() + offsetMs);
    const startUtcMs = Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - offsetMs;

    return {
      start: new Date(startUtcMs),
      end: new Date(startUtcMs + 24 * 60 * 60 * 1000),
    };
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
          displayOrderNumber: true,
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

  private getCustomerRefreshExpiresAt(): Date {
    return new Date(Date.now() + getCustomerJwtRefreshExpiresIn() * 1000);
  }
}
