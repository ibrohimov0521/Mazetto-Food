import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  OrderStatus,
  Prisma,
  ShiftStatus,
} from "@prisma/client";
import { resolveRestaurantScope } from "../../common/auth/tenant-scope";
import { IdempotencyService } from "../../common/idempotency/idempotency.service";
import {
  buildIdempotencyScope,
  hashCanonicalJson,
  normalizeIdempotencyKey,
} from "../../common/idempotency/idempotency-key";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { sumNetCollectedPayments } from "../payments/refund-ledger";
import {
  eventForLegacyStatus,
  orderStateForLegacyStatus,
  recordOrderEvent,
} from "../orders/order-events";
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

type CourierStatusContext = {
  idempotencyKey?: string;
  correlationId?: string;
};

const COURIER_STATUS_RESULT_INCLUDE = {
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
          changedByUser: { select: { displayName: true, email: true } },
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
} satisfies Prisma.CustomerOrderInclude;

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
    @Optional() private readonly idempotency?: IdempotencyService,
  ) {}

  async listCourierDeliveryOrders(
    query: ListOnlineOrdersDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = requireEmployee(user);
    const scope = await resolveRestaurantScope(
      this.prisma,
      user,
      query.branchId,
    );
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
        branch: {
          tenantId: scope.tenantId,
          ...(scope.branchId ? { id: scope.branchId } : {}),
        },
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
            payments: {
              select: {
                amount: true,
                status: true,
                refunds: { select: { amount: true } },
              },
            },
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

    return customerOrders.map((customerOrder) => {
      const { payments, ...order } = customerOrder.order;
      const paidTotal = sumNetCollectedPayments(payments);
      const outstanding = order.total.sub(paidTotal);
      return withDeliveryDistance(
        withDerivedCustomerOrderStatus({
          ...customerOrder,
          order: {
            ...order,
            outstandingAmount: outstanding.greaterThan(0)
              ? outstanding.toString()
              : "0",
          },
        }),
      );
    });
  }

  async listCourierDeliveryOrderHistory(
    query: ListOnlineOrdersDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = requireEmployee(user);
    const scope = await resolveRestaurantScope(
      this.prisma,
      user,
      query.branchId,
    );
    const day = todayTashkentRange();
    const status = toOrderStatus(query.status);
    const search = query.search?.trim();

    const customerOrders = await this.prisma.customerOrder.findMany({
      where: {
        type: "DELIVERY",
        branch: {
          tenantId: scope.tenantId,
          ...(scope.branchId ? { id: scope.branchId } : {}),
        },
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
    context?: CourierStatusContext,
  ) {
    const employeeId = requireEmployee(user);
    const scope = await resolveRestaurantScope(this.prisma, user);
    const nextStatus = dto.status as OrderStatus;
    const rawIdempotencyKey = context?.idempotencyKey ?? dto.idempotencyKey;
    const idempotencyKey =
      rawIdempotencyKey === undefined
        ? undefined
        : normalizeIdempotencyKey(rawIdempotencyKey);
    const requestHash = idempotencyKey
      ? hashCanonicalJson({
          customerOrderId,
          employeeId,
          status: dto.status,
          expectedVersion: dto.expectedVersion ?? null,
          shiftId: dto.shiftId ?? null,
          paymentMethodCode: dto.paymentMethodCode ?? null,
          amount: dto.amount ?? null,
        })
      : undefined;
    let decision: Awaited<ReturnType<IdempotencyService["start"]>> | undefined;

    if (idempotencyKey && requestHash) {
      if (!this.idempotency) {
        throw new BadRequestException(
          "Courier status idempotency is unavailable",
        );
      }
      decision = await this.idempotency.start({
        scope: buildIdempotencyScope(
          "courier-order-status",
          scope.tenantId,
          customerOrderId,
          employeeId,
          user.id,
        ),
        key: idempotencyKey,
        requestHash,
        correlationId: context?.correlationId ?? idempotencyKey,
        actorId: user.id,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      });

      if (decision.kind === "REPLAY") {
        if (
          decision.record.resourceType !== "CUSTOMER_ORDER" ||
          decision.record.resourceId !== customerOrderId
        ) {
          throw new ConflictException(
            "Previous courier update did not complete",
          );
        }
        const previous = await this.prisma.customerOrder.findFirst({
          where: {
            id: customerOrderId,
            type: "DELIVERY",
            branch: {
              tenantId: scope.tenantId,
              ...(scope.branchId ? { id: scope.branchId } : {}),
            },
          },
          include: COURIER_STATUS_RESULT_INCLUDE,
        });
        if (!previous) {
          throw new NotFoundException("Online order not found");
        }
        if (
          (previous.order.servedById &&
            previous.order.servedById !== employeeId) ||
          (previous.order.cancelledById &&
            previous.order.cancelledById !== employeeId)
        ) {
          throw new ForbiddenException(
            "Bu buyurtmani boshqa kuryer olib ketgan.",
          );
        }
        return withDerivedCustomerOrderStatus(previous);
      }
    }

    let customerOrder;
    try {
      customerOrder = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT o.id FROM "orders" o JOIN "customer_orders" c ON c."orderId" = o.id JOIN "branches" b ON b.id = c."branchId" WHERE c.id = ${customerOrderId} AND b."tenantId" = ${scope.tenantId} FOR UPDATE OF o`;
        const existing = await tx.customerOrder.findFirst({
          where: { id: customerOrderId, branch: { tenantId: scope.tenantId } },
          include: {
            order: { include: { payments: { include: { refunds: true } } } },
          },
        });

        if (!existing) {
          throw new NotFoundException("Online order not found");
        }

        if (existing.type !== "DELIVERY") {
          throw new BadRequestException(
            "Only delivery orders can be updated by courier",
          );
        }

        if (scope.branchId && existing.branchId !== scope.branchId) {
          throw new ForbiddenException("Cannot access another branch");
        }

        if (
          dto.expectedVersion !== undefined &&
          existing.order.version !== dto.expectedVersion
        ) {
          throw new ConflictException({
            error: "ORDER_VERSION_CONFLICT",
            message: "Buyurtma boshqa qurilmada yangilangan",
            details: { currentVersion: existing.order.version },
          });
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
            const paidTotal = sumNetCollectedPayments(existing.order.payments);
            const outstanding = existing.order.total.sub(paidTotal);
            if (outstanding.greaterThan(0)) {
              if (dto.amount !== undefined && !outstanding.equals(dto.amount)) {
                throw new BadRequestException(
                  "Buyurtmani yakunlash uchun qolgan summa to'liq qabul qilinishi kerak",
                );
              }
              const courierShift = await tx.shift.findFirst({
                where: {
                  employeeId,
                  branchId: existing.branchId,
                  status: ShiftStatus.OPEN,
                },
                orderBy: { openedAt: "desc" },
                select: { id: true },
              });
              if (!courierShift)
                throw new BadRequestException(
                  "Naqd pulni yig'ishdan oldin xodim smenasi ochiq bo'lishi shart",
                );
              if (dto.shiftId && dto.shiftId !== courierShift.id)
                throw new ForbiddenException(
                  "To'lov faqat o'zingizning ochiq smenangizga yoziladi",
                );
              await this.paymentsService.processOrderPayment(
                {
                  orderId: existing.orderId,
                  idempotencyKey:
                    idempotencyKey ?? "courier-cash-" + existing.orderId,
                  shiftId: courierShift.id,
                  payments: [
                    {
                      paymentMethodCode: dto.paymentMethodCode ?? "CASH",
                      amount: Number(outstanding),
                    },
                  ],
                },
                user,
                undefined,
                undefined,
                undefined,
                tx,
              );
            }
          }

          const updated = await tx.order.update({
            where: { id: existing.orderId },
            data: {
              status: nextStatus,
              orderState: orderStateForLegacyStatus(nextStatus),
              version: { increment: 1 },
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

          await recordOrderEvent(tx, {
            orderId: existing.orderId,
            branchId: existing.branchId,
            aggregateVersion: updated.version,
            eventType: eventForLegacyStatus(nextStatus),
            actorType: "STAFF",
            actorId: user.id,
            source: "API",
            previousState: existing.order.orderState,
            newState: updated.orderState,
            payload: {
              fromStatus: existing.order.status,
              toStatus: nextStatus,
            },
            reasonCode: `COURIER_${nextStatus}`,
            correlationId: context?.correlationId,
            idempotencyKey,
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
          await tx.notificationOutbox.create({
            data: {
              tenantId: scope.tenantId,
              dedupeKey: `staff_status_refresh:courier:${existing.orderId}:${updated.version}`,
              kind: "staff_status_refresh",
              orderId: existing.orderId,
              payload: { status: nextStatus },
            },
          });
        }

        const result = await tx.customerOrder.findUniqueOrThrow({
          where: { id: customerOrderId },
          include: COURIER_STATUS_RESULT_INCLUDE,
        });
        if (decision?.kind === "CLAIMED" && requestHash) {
          await this.idempotency!.complete(
            decision.record.id,
            {
              requestHash,
              responseStatus: 200,
              responseBody: {
                customerOrderId: result.id,
                orderId: result.orderId,
                status: result.order.status,
              },
              resourceType: "CUSTOMER_ORDER",
              resourceId: result.id,
            },
            tx,
          );
        }
        return result;
      });
    } catch (error) {
      if (decision?.kind === "CLAIMED" && requestHash) {
        await this.idempotency!.fail(
          decision.record.id,
          requestHash,
          "COURIER_STATUS_UPDATE_FAILED",
        ).catch(() => undefined);
      }
      throw error;
    }

    this.kitchenService.emitOrderStatusChanged({
      orderId: customerOrder.orderId,
    });
    return withDerivedCustomerOrderStatus(customerOrder);
  }

  async listCouriers(user: AuthenticatedUser) {
    const scope = await resolveRestaurantScope(this.prisma, user);
    const day = todayTashkentRange();

    const couriers = await this.prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        branch: {
          tenantId: scope.tenantId,
          ...(scope.branchId ? { id: scope.branchId } : {}),
        },
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
          branch: {
            tenantId: scope.tenantId,
            ...(scope.branchId ? { id: scope.branchId } : {}),
          },
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
          branch: {
            tenantId: scope.tenantId,
            ...(scope.branchId ? { id: scope.branchId } : {}),
          },
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
    const scope = await resolveRestaurantScope(this.prisma, user);

    const customerOrders = await this.prisma.customerOrder.findMany({
      where: {
        type: "DELIVERY",
        branch: {
          tenantId: scope.tenantId,
          ...(scope.branchId ? { id: scope.branchId } : {}),
        },
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
    const scope = await resolveRestaurantScope(this.prisma, user);

    return this.prisma.$transaction(async (tx) => {
      /*
       * `FOR UPDATE` — kuryerning o'zi shu lahzada buyurtmani olayotgan
       * bo'lishi mumkin (`updateCourierOrderStatus` ham shu qulfni oladi).
       * Qulfsiz ikkalasi ham muvaffaqiyatli tugab, oxirgi yozuv yutardi.
       */
      await tx.$queryRaw`SELECT o.id FROM "orders" o JOIN "customer_orders" c ON c."orderId" = o.id JOIN "branches" b ON b.id = c."branchId" WHERE c.id = ${customerOrderId} AND b."tenantId" = ${scope.tenantId} FOR UPDATE OF o`;

      const existing = await tx.customerOrder.findFirst({
        where: { id: customerOrderId, branch: { tenantId: scope.tenantId } },
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
      if (scope.branchId && existing.branchId !== scope.branchId) {
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
