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
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OrderStatus, Prisma } from "@prisma/client";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
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
import type {
  CustomerCheckoutQuoteDto,
  CreateOnlineOrderDto,
} from "./dto/customer.dto";
import {
  buildOrderSearchWhere,
  customerOrderInclude,
  productInclude,
  requireEmployee,
  toOrderStatus,
  todayTashkentRange,
  withDeliveryDistance,
  withDerivedCustomerOrderStatus,
} from "./customer-shared";

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
      include: productInclude(),
    });
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        isAvailable: true,
        code: { in: [...customerVisibleProductCodes] },
      },
      include: productInclude(),
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

  async getCustomerDashboard(customerId: string) {
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      include: {
        customerOrders: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: customerOrderInclude(),
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
        withDerivedCustomerOrderStatus(customerOrder),
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
      include: customerOrderInclude({ includePayments: true }),
    });

    return customerOrders.map((customerOrder) =>
      withDerivedCustomerOrderStatus(customerOrder),
    );
  }

  async getCustomerOrder(customerId: string, customerOrderId: string) {
    const customerOrder = await this.prisma.customerOrder.findFirst({
      where: {
        id: customerOrderId,
        customerId,
      },
      include: customerOrderInclude({ includePayments: true }),
    });

    if (!customerOrder) {
      throw new NotFoundException("Customer order not found");
    }

    return withDerivedCustomerOrderStatus(customerOrder);
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
      withDerivedCustomerOrderStatus(customerOrder),
    );
  }

  async listCourierDeliveryOrders(
    query: ListOnlineOrdersDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = requireEmployee(user);
    const branchId = resolveBranchScope(user, query.branchId);
    const day = todayTashkentRange();
    const status = toOrderStatus(query.status);
    const search = query.search?.trim();

    const orderFilters: Prisma.OrderWhereInput[] = [
      { OR: [{ servedById: null }, { servedById: employeeId }] },
    ];
    if (search) {
      orderFilters.push(buildOrderSearchWhere(search));
    }

    const customerOrders = await this.prisma.customerOrder.findMany({
      where: {
        type: "DELIVERY",
        ...(branchId ? { branchId } : {}),
        order: {
          createdAt: { gte: day.start, lt: day.end },
          status: status ?? {
            notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
          },
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
      withDeliveryDistance(withDerivedCustomerOrderStatus(customerOrder)),
    );
  }

  async listCourierDeliveryOrderHistory(
    query: ListOnlineOrdersDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = requireEmployee(user);
    const branchId = resolveBranchScope(user, query.branchId);
    const day = todayTashkentRange();
    const status = toOrderStatus(query.status);
    const search = query.search?.trim();

    const customerOrders = await this.prisma.customerOrder.findMany({
      where: {
        type: "DELIVERY",
        ...(branchId ? { branchId } : {}),
        order: {
          servedById: employeeId,
          createdAt: { gte: day.start, lt: day.end },
          ...(status ? { status } : {}),
          ...(search ? buildOrderSearchWhere(search) : {}),
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
      withDeliveryDistance(withDerivedCustomerOrderStatus(customerOrder)),
    );
  }

  async updateCourierOrderStatus(
    customerOrderId: string,
    dto: UpdateCourierOrderStatusDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = requireEmployee(user);
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
        throw new ForbiddenException(
          "Bu buyurtmani boshqa kuryer olib ketgan.",
        );
      }

      if (existing.order.status !== nextStatus) {
        if (
          existing.order.status === OrderStatus.SERVED &&
          nextStatus === OrderStatus.READY
        ) {
          throw new BadRequestException(
            "Yo'ldagi buyurtmani tayyor holatiga qaytarib bo'lmaydi.",
          );
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

    this.kitchenService.emitOrderStatusChanged({
      orderId: customerOrder.orderId,
    });
    kitchenEvents.emit(kitchenOrderStatusChangedEvent, {
      orderId: customerOrder.orderId,
      action: "refresh",
    });
    return withDerivedCustomerOrderStatus(customerOrder);
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

  async listCouriers(user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);
    const day = todayTashkentRange();

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
      withDeliveryDistance(withDerivedCustomerOrderStatus(customerOrder)),
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
}
