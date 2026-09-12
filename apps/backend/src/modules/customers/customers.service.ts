import { KitchenService } from "../kitchen/kitchen.service";
import {
} from "../kitchen/kitchen-events";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OrderStatus, Prisma } from "@prisma/client";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {} from "../../config/auth.config";
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
  customerCancelRejection,
  customerOrderInclude,
  productInclude,
  withDerivedCustomerOrderStatus,
} from "./customer-shared";
import type { CancelCustomerOrderDto } from "./dto/cancel-customer-order.dto";
import { syncKitchenTickets } from "../kitchen/kitchen-status-sync";

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

  /*
   * MIJOZNING O'ZI BUYURTMANI BEKOR QILISHI.
   *
   * Egasining qoidasi: oshxona tayyorlashni boshlagandan keyin bekor
   * qilish faqat qo'ng'iroq orqali. Shu sababli chegara `PREPARING`
   * dan OLDIN turadi (`customerCancelRejection`), va rad etish xabari
   * mijozga nima qilishini AYTADI — shunchaki "mumkin emas" demaydi.
   *
   * TRANZAKSIYA ichida: holat, bekor qilish izlari, oshxona chiptasi
   * va tarix yozuvi birgalikda yoziladi yoki umuman yozilmaydi.
   *
   * ZAXIRA QAYTARILMAYDI. Bu ataylab: mavjud xodim tomonidagi bekor
   * qilish ham zaxirani qaytarmaydi, ya'ni bu butun tizim bo'ylab
   * bir xil xatti-harakat. Uni faqat bir joyda tuzatish ombor hisobini
   * yana chalkashtirardi — alohida ish sifatida qilinishi kerak.
   */
  async cancelCustomerOrder(
    customerId: string,
    customerOrderId: string,
    dto: CancelCustomerOrderDto,
  ) {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const customerOrder = await tx.customerOrder.findFirst({
        where: { id: customerOrderId, customerId },
        select: { id: true, orderId: true },
      });

      if (!customerOrder) {
        throw new NotFoundException("Customer order not found");
      }

      /*
       * Qatorni QULFLASH: kassir yoki oshxona xuddi shu lahzada
       * holatni o'zgartirayotgan bo'lishi mumkin, va qulfsiz mijoz
       * allaqachon pishirilayotgan buyurtmani bekor qilib yuborardi.
       */
      await tx.$executeRaw`SELECT id FROM "orders" WHERE id = ${customerOrder.orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id: customerOrder.orderId },
        select: { id: true, status: true, paymentStatus: true, tableId: true },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      const rejection = customerCancelRejection(order);

      if (rejection) {
        throw new BadRequestException(rejection);
      }

      const reason = dto.reason?.trim();

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason
            ? `Mijoz bekor qildi: ${reason}`
            : "Mijoz bekor qildi",
        },
      });

      await syncKitchenTickets(tx, order.id, OrderStatus.CANCELLED);

      /*
       * `OrderStatusHistory` da mijoz uchun alohida maydon yo'q
       * (faqat xodim va foydalanuvchi), shuning uchun aktor SABABDA
       * ochiq yoziladi. Sxemani o'zgartirish migratsiya talab qiladi
       * va alohida qaror.
       */
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          reason: reason
            ? `Mijoz bekor qildi: ${reason}`
            : "Mijoz bekor qildi",
        },
      });

      return tx.customerOrder.findFirst({
        where: { id: customerOrderId },
        include: customerOrderInclude({ includePayments: true }),
      });
    });

    if (!cancelled) {
      throw new NotFoundException("Customer order not found");
    }

    this.kitchenService.emitOrderStatusChanged(cancelled.order);
    return withDerivedCustomerOrderStatus(cancelled);
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
}
