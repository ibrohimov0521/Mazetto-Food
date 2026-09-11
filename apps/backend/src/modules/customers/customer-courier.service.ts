import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ShiftStatus,
} from "@prisma/client";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import {
  kitchenEvents,
  kitchenOrderStatusChangedEvent,
} from "../kitchen/kitchen-events";
import { syncKitchenTickets } from "../kitchen/kitchen-status-sync";
import { KitchenService } from "../kitchen/kitchen.service";
import {
  buildOrderSearchWhere,
  requireEmployee,
  toOrderStatus,
  todayTashkentRange,
  withDeliveryDistance,
  withDerivedCustomerOrderStatus,
} from "./customer-shared";
import type {
  ListOnlineOrdersDto,
  UpdateCourierOrderStatusDto,
} from "./dto/list-customers.dto";

/*
 * KURYER domeni: yetkazish ro'yxatlari, holat o'zgartirish va admin
 * nazorati.
 *
 * NIMA UCHUN AJRATILDI. Bu 464 qator `customers.service.ts` ning
 * uchdan birini egallardi va mijoz katalogiga ham, autentifikatsiyaga
 * ham hech qanday aloqasi yo'q. U faqat bazaga va oshxona servisiga
 * qaraydi.
 *
 * IKKI XIL EGALIK MODELI shu yerda uchrashadi:
 *   - kuryer O'ZI oladi (birinchi kelgan oladi), `updateCourierOrderStatus`
 *   - admin BIRIKTIRADI yoki qaytadan biriktiradi, `assignCourier`
 * Ikkalasi ham bitta `Order.servedById` ustunini yozadi va bitta qator
 * qulfini oladi — aks holda ular bir-birining yozuvini bosib ketardi.
 */
@Injectable()
export class CustomerCourierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenService: KitchenService,
    private readonly paymentsService: PaymentsService,
  ) {}

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
            statusHistory: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                fromStatus: true,
                toStatus: true,
                reason: true,
                createdAt: true,
                changedByEmployee: {
                  select: {
                    firstName: true,
                    lastName: true,
                    employeeCode: true,
                  },
                },
                changedByUser: {
                  select: { displayName: true, email: true },
                },
              },
            },
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
            statusHistory: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                fromStatus: true,
                toStatus: true,
                reason: true,
                createdAt: true,
                changedByEmployee: {
                  select: {
                    firstName: true,
                    lastName: true,
                    employeeCode: true,
                  },
                },
                changedByUser: {
                  select: { displayName: true, email: true },
                },
              },
            },
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
        include: { order: { include: { payments: true } } },
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
        if (nextStatus === OrderStatus.COMPLETED) {
          const paidTotal = existing.order.payments
            .filter(payment => payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.SUCCESS)
            .reduce((total, payment) => total.add(payment.amount), new Prisma.Decimal(0));
          const outstanding = existing.order.total.sub(paidTotal);
          if (outstanding.greaterThan(0)) {
            if (dto.amount !== undefined && !outstanding.equals(dto.amount)) {
              throw new BadRequestException("Buyurtmani yakunlash uchun qolgan summa to'liq qabul qilinishi kerak");
            }
            const courierShift = await tx.shift.findFirst({
              where: { employeeId, branchId: existing.branchId, status: ShiftStatus.OPEN },
              orderBy: { openedAt: "desc" },
              select: { id: true },
            });
            if (!courierShift) throw new BadRequestException("Naqd pulni yig'ishdan oldin xodim smenasi ochiq bo'lishi shart");
            if (dto.shiftId && dto.shiftId !== courierShift.id) throw new ForbiddenException("To'lov faqat o'zingizning ochiq smenangizga yoziladi");
            await this.paymentsService.processOrderPayment({
              orderId: existing.orderId,
              idempotencyKey: dto.idempotencyKey ?? "courier-cash-" + existing.orderId,
              shiftId: courierShift.id,
              payments: [{ paymentMethodCode: dto.paymentMethodCode ?? "CASH", amount: Number(outstanding) }],
            }, user, undefined, undefined, undefined, tx);
          }
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
              statusHistory: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                fromStatus: true,
                toStatus: true,
                reason: true,
                createdAt: true,
                changedByEmployee: {
                  select: {
                    firstName: true,
                    lastName: true,
                    employeeCode: true,
                  },
                },
                changedByUser: {
                  select: { displayName: true, email: true },
                },
              },
            },
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
