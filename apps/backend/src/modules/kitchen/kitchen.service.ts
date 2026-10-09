import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  KitchenTicketStatus,
  OrderItemStatus,
  OrderState,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  resolveRestaurantScope,
  resolveSoleActiveTenantId,
} from "../../common/auth/tenant-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import {
  MAX_ACTIVE_KITCHEN_TICKETS,
  trimKitchenQueue,
} from "./kitchen-queue-window";
import { ensureCancellationReceipt } from "../receipts/receipt-writer";
import {
  eventForLegacyStatus,
  orderStateForLegacyStatus,
  recordOrderEvent,
} from "../orders/order-events";
import { KitchenGateway } from "./kitchen.gateway";
import { orderStatusAfterKitchenHandoff } from "./kitchen-status-sync";
import { kitchenHistoryRange } from "./kitchen-history-range";

type TransactionClient = Prisma.TransactionClient;
export type KitchenStaffAction =
  | "accept"
  | "start_preparing"
  | "mark_ready"
  | "complete"
  | "cancel";
type KitchenTransitionActor = {
  user?: AuthenticatedUser;
  reasonPrefix: string;
  cancellationReason?: string;
  expectedVersion?: number;
  correlationId?: string;
  idempotencyKey?: string;
  reasonCode?: string;
  recipientName?: string;
  completeIdempotency?: (
    tx: Prisma.TransactionClient,
    ticket: { id: string; status: KitchenTicketStatus; version: number },
  ) => Promise<void>;
};
type KitchenTicketActionContext = {
  expectedVersion?: number;
  correlationId?: string;
  idempotencyKey?: string;
  reasonCode?: string;
  recipientName?: string;
  completeIdempotency?: KitchenTransitionActor["completeIdempotency"];
};
type KitchenTransitionOrder = {
  id: string;
  branchId: string;
  type: OrderType;
  status: OrderStatus;
  orderState: OrderState;
  version: number;
  acceptedAt: Date | null;
  acceptedById: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  paymentStatus: PaymentStatus;
  total: Prisma.Decimal;
  payments: { amount: Prisma.Decimal; status: PaymentStatus }[];
  customerOrder: {
    paymentMethod: string | null;
    customer: { telegramChatId: string | null } | null;
  } | null;
  kitchenTickets: {
    id: string;
    orderId: string;
    status: KitchenTicketStatus;
    version: number;
    acceptedAt: Date | null;
    completedAt: Date | null;
  }[];
};

@Injectable()
export class KitchenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: KitchenGateway,
  ) {}

  async listOrders(user: AuthenticatedUser) {
    return (await this.listOrdersWithOverflow(user)).items;
  }

  async listOrdersWithOverflow(user: AuthenticatedUser) {
    this.requireEmployee(user);
    const scope = await resolveRestaurantScope(this.prisma, user);

    const where = {
      order: {
        ...(scope.branchId
          ? { branchId: scope.branchId }
          : { branch: { tenantId: scope.tenantId } }),
        status: {
          notIn: [
            OrderStatus.SERVED,
            OrderStatus.COMPLETED,
            OrderStatus.CANCELLED,
          ],
        },
      },
      status: {
        in: [
          KitchenTicketStatus.NEW,
          KitchenTicketStatus.ACCEPTED,
          KitchenTicketStatus.COOKING,
          KitchenTicketStatus.READY,
        ],
      },
    };
    const tickets = await this.prisma.kitchenTicket.findMany({
      where,
      include: this.ticketInclude(),
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: MAX_ACTIVE_KITCHEN_TICKETS + 1,
    });
    return trimKitchenQueue(tickets);
  }

  async listHistory(
    query: {
      status?: string;
      search?: string;
      limit?: string;
      offset?: string;
      from?: string;
      to?: string;
      sort?: string;
    },
    user: AuthenticatedUser,
  ) {
    this.requireEmployee(user);
    const scope = await resolveRestaurantScope(this.prisma, user);
    const range = kitchenHistoryRange(query.from, query.to);
    const status = this.toKitchenTicketStatus(query.status);
    const search = query.search?.trim();

    const tickets = await this.prisma.kitchenTicket.findMany({
      where: {
        ...(status ? { status } : {}),
        order: {
          ...(scope.branchId
            ? { branchId: scope.branchId }
            : { branch: { tenantId: scope.tenantId } }),
          createdAt: { gte: range.start, lt: range.end },
          ...(search
            ? {
                OR: [
                  { orderNumber: { contains: search, mode: "insensitive" } },
                  {
                    displayOrderNumber: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    items: {
                      some: {
                        productName: { contains: search, mode: "insensitive" },
                      },
                    },
                  },
                ],
              }
            : {}),
        },
      },
      select: this.historySelect(),
      orderBy:
        query.sort === "oldest"
          ? [{ createdAt: "asc" }, { id: "asc" }]
          : [{ createdAt: "desc" }, { id: "desc" }],
      skip: this.parseOffset(query.offset),
      take: this.parseLimit(query.limit),
    });

    return tickets;
  }

  async createTicketForOrder(tx: TransactionClient, orderId: string) {
    const existingTicket = await tx.kitchenTicket.findFirst({
      where: {
        orderId,
        status: {
          notIn: [KitchenTicketStatus.COMPLETED, KitchenTicketStatus.CANCELLED],
        },
      },
      include: this.ticketInclude(),
    });

    if (existingTicket) {
      return existingTicket;
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        version: true,
        isSupplemental: true,
        supplementNumber: true,
        items: {
          where: { status: OrderItemStatus.ACTIVE },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            productName: true,
            variantName: true,
            quantity: true,
            notes: true,
            modifierSnapshot: true,
            status: true,
            product: {
              select: {
                printerRouting: true,
                printer: { select: { id: true, name: true, type: true } },
              },
            },
          },
        },
      },
    });
    if (!order || order.items.length === 0) {
      throw new BadRequestException(
        "Oshxona chiptasi uchun kamida bitta faol mahsulot kerak",
      );
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await tx.kitchenTicket.create({
          data: {
            orderId,
            ticketNumber: this.createTicketNumber(),
            revisionNumber: order.supplementNumber ?? 1,
            isSupplement: order.isSupplemental,
            sourceOrderVersion: order.version,
            items: {
              create: order.items.map((item) => ({
                orderItemId: item.id,
                productName: item.productName,
                variantName: item.variantName,
                quantity: item.quantity,
                notes: item.notes,
                modifierSnapshot: item.modifierSnapshot ?? Prisma.JsonNull,
                stationRouting: item.product?.printerRouting ?? "NONE",
                printerIdSnapshot: item.product?.printer?.id ?? null,
                printerNameSnapshot: item.product?.printer?.name ?? null,
                printerTypeSnapshot: item.product?.printer?.type ?? null,
                status: item.status,
              })),
            },
            events: {
              create: {
                eventType: order.isSupplemental
                  ? "KitchenSupplementCreated"
                  : "KitchenTicketCreated",
                newStatus: KitchenTicketStatus.NEW,
                reason: order.isSupplemental
                  ? `Qo'shimcha #${order.supplementNumber ?? 1}`
                  : "Asosiy buyurtma oshxonaga yuborildi",
                version: 1,
              },
            },
          },
          include: this.ticketInclude(),
        });
      } catch (error) {
        if (!this.isUniqueTicketError(error) || attempt === 4) {
          throw error;
        }
      }
    }

    throw new BadRequestException("Unable to create kitchen ticket");
  }

  async acceptTicket(id: string, user: AuthenticatedUser) {
    const result = await this.applyTicketAction(id, "accept", user);
    return result.ticket;
  }

  async startTicket(id: string, user: AuthenticatedUser) {
    const result = await this.applyTicketAction(id, "start_preparing", user);
    return result.ticket;
  }

  async readyTicket(id: string, user: AuthenticatedUser) {
    const result = await this.applyTicketAction(id, "mark_ready", user);
    return result.ticket;
  }

  async completeTicket(id: string, user: AuthenticatedUser) {
    const result = await this.applyTicketAction(id, "complete", user);
    return result.ticket;
  }

  async cancelTicket(id: string, user: AuthenticatedUser, reason?: string) {
    const result = await this.applyTicketAction(id, "cancel", user, reason);
    return result.ticket;
  }

  async getTicket(id: string, user: AuthenticatedUser) {
    this.requireEmployee(user);
    const scope = await resolveRestaurantScope(this.prisma, user);
    const ticket = await this.prisma.kitchenTicket.findFirst({
      where: {
        id,
        order: scope.branchId
          ? { branchId: scope.branchId }
          : { branch: { tenantId: scope.tenantId } },
      },
      include: this.ticketInclude(),
    });
    if (!ticket) {
      throw new NotFoundException("Oshxona chiptasi topilmadi");
    }
    return ticket;
  }

  async recordItemCancellation(
    tx: TransactionClient,
    input: {
      orderItemId: string;
      actorId: string;
      reason: string;
      reasonCode: string;
      correlationId?: string;
      idempotencyKey?: string;
    },
  ): Promise<void> {
    const linkedItems = await tx.kitchenTicketItem.findMany({
      where: {
        orderItemId: input.orderItemId,
        status: OrderItemStatus.ACTIVE,
      },
      select: {
        id: true,
        ticketId: true,
        ticket: { select: { status: true } },
      },
    });

    for (const linkedItem of linkedItems) {
      const cancelled = await tx.kitchenTicketItem.updateMany({
        where: { id: linkedItem.id, status: OrderItemStatus.ACTIVE },
        data: { status: OrderItemStatus.CANCELLED },
      });
      if (cancelled.count !== 1) {
        continue;
      }

      const ticket = await tx.kitchenTicket.update({
        where: { id: linkedItem.ticketId },
        data: { version: { increment: 1 } },
        select: { version: true },
      });
      await tx.kitchenTicketEvent.create({
        data: {
          ticketId: linkedItem.ticketId,
          eventType: "KitchenItemCancelled",
          previousStatus: linkedItem.ticket.status,
          newStatus: linkedItem.ticket.status,
          orderItemId: input.orderItemId,
          actorId: input.actorId,
          reason: input.reason,
          correlationId: input.correlationId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          payload: { reasonCode: input.reasonCode },
          version: ticket.version,
        },
      });
    }
  }

  async applyTicketAction(
    id: string,
    action: KitchenStaffAction,
    user: AuthenticatedUser,
    reason?: string,
    context?: KitchenTicketActionContext,
  ) {
    const scope = await resolveRestaurantScope(this.prisma, user);
    const existingTicket = await this.prisma.kitchenTicket.findFirst({
      where: {
        id,
        order: scope.branchId
          ? { branchId: scope.branchId }
          : { branch: { tenantId: scope.tenantId } },
      },
      select: { orderId: true },
    });

    if (!existingTicket) {
      throw new NotFoundException("Oshxona chiptasi topilmadi");
    }

    /*
     * Oshxona yozgan sabab SAQLANADI. Ilgari har bekor qilish bir xil
     * qat'iy satr bilan yozilardi, ya'ni tarixdan nima bo'lganini
     * bilib bo'lmasdi.
     */
    const trimmed = reason?.trim();

    return this.applyOrderAction(existingTicket.orderId, action, {
      user,
      reasonPrefix: "Kitchen UI",
      cancellationReason: trimmed
        ? `Oshxona bekor qildi: ${trimmed}`
        : "Oshxona bekor qildi",
      ...(context?.correlationId
        ? { correlationId: context.correlationId }
        : {}),
      ...(context?.idempotencyKey
        ? { idempotencyKey: context.idempotencyKey }
        : {}),
      ...(context?.reasonCode ? { reasonCode: context.reasonCode } : {}),
      ...(context?.recipientName
        ? { recipientName: context.recipientName }
        : {}),
      ...(context?.completeIdempotency
        ? { completeIdempotency: context.completeIdempotency }
        : {}),
      ...(context?.expectedVersion !== undefined
        ? { expectedVersion: context.expectedVersion }
        : {}),
    });
  }

  async applyOrderAction(
    orderId: string,
    action: KitchenStaffAction,
    actor: KitchenTransitionActor,
  ) {
    const scope = actor.user
      ? await resolveRestaurantScope(this.prisma, actor.user)
      : {
          tenantId: await resolveSoleActiveTenantId(this.prisma),
          branchId: undefined,
        };
    const result = await this.prisma.$transaction(async (tx) => {
      const scopedOrder = await this.findOrderForTransition(tx, orderId, scope);
      if (!scopedOrder) {
        throw new NotFoundException("Order not found");
      }

      await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;
      const order = await this.findOrderForTransition(tx, orderId, scope);
      if (!order) {
        throw new NotFoundException("Order not found");
      }

      const storedTicket = order.kitchenTickets[0] ?? null;
      const ticket =
        storedTicket &&
        ![
          KitchenTicketStatus.COMPLETED,
          KitchenTicketStatus.CANCELLED,
        ].includes(storedTicket.status as "COMPLETED" | "CANCELLED")
          ? {
              ...storedTicket,
              status: storedTicket.status,
            }
          : storedTicket;

      if (!ticket) {
        throw new BadRequestException("Oshxona chiptasi topilmadi");
      }

      const transition = this.resolveTransition(order, ticket, action);

      if (
        transition.changed &&
        actor.expectedVersion !== undefined &&
        ticket.version !== actor.expectedVersion
      ) {
        throw new ConflictException({
          message: "Oshxona chiptasi boshqa qurilmada yangilangan",
          code: "KITCHEN_VERSION_CONFLICT",
          details: { currentVersion: ticket.version },
        });
      }

      if (!transition.changed) {
        const unchanged = {
          action,
          changed: false,
          order: await this.findOrderForTransition(tx, orderId, scope),
          ticket: await this.findTicketById(tx, ticket.id),
        };
        await actor.completeIdempotency?.(tx, unchanged.ticket);
        return unchanged;
      }

      const now = new Date();
      const recipientName =
        transition.orderStatus === OrderStatus.COMPLETED &&
        order.type === OrderType.TAKEAWAY
          ? actor.recipientName?.trim()
          : undefined;
      if (
        transition.orderStatus === OrderStatus.COMPLETED &&
        order.type === OrderType.TAKEAWAY
      ) {
        const paidTotal = order.payments
          .filter((payment) =>
            payment.status === PaymentStatus.PAID ||
            payment.status === PaymentStatus.SUCCESS,
          )
          .reduce(
            (total, payment) => total.add(payment.amount),
            new Prisma.Decimal(0),
          );
        if (order.total.greaterThan(paidTotal)) {
          throw new BadRequestException(
            "Olib ketish buyurtmasini topshirishdan oldin kassada to'lovni qabul qiling",
          );
        }
      }

      const orderData: Prisma.OrderUpdateInput = {};
      const user = actor.user;

      if (order.status !== transition.orderStatus) {
        orderData.status = transition.orderStatus;
        orderData.orderState = orderStateForLegacyStatus(
          transition.orderStatus,
        );
        orderData.version = { increment: 1 };
      }

      if (
        transition.orderStatus === OrderStatus.CONFIRMED &&
        !order.acceptedAt
      ) {
        orderData.acceptedAt = now;

        if (user?.employeeId && !order.acceptedById) {
          orderData.acceptedBy = { connect: { id: user.employeeId } };
        }
      }

      if (transition.orderStatus === OrderStatus.CANCELLED) {
        orderData.cancelledAt = order.cancelledAt ?? now;
        orderData.cancellationReason =
          order.cancellationReason ?? actor.cancellationReason ?? null;

        if (user?.employeeId) {
          orderData.cancelledBy = { connect: { id: user.employeeId } };
        }
      }

      if (transition.orderStatus === OrderStatus.COMPLETED) {
        orderData.closedAt = now;
        if (user?.employeeId) {
          orderData.closedBy = { connect: { id: user.employeeId } };
          orderData.servedBy = { connect: { id: user.employeeId } };
        }
      }

      if (Object.keys(orderData).length > 0) {
        const updated = await tx.order.update({
          where: { id: orderId },
          data: orderData,
        });
        if (order.status !== transition.orderStatus) {
          await recordOrderEvent(tx, {
            orderId,
            branchId: order.branchId,
            aggregateVersion: updated.version,
            eventType: eventForLegacyStatus(transition.orderStatus),
            actorType: user ? "STAFF" : "SYSTEM",
            actorId: user?.id,
            source: user ? "API" : "SYSTEM",
            previousState: order.orderState,
            newState: updated.orderState,
            payload: {
              fromStatus: order.status,
              toStatus: transition.orderStatus,
              kitchenAction: action,
              ...(recipientName ? { recipientName } : {}),
            },
            reasonCode: `KITCHEN_${action.toUpperCase()}`,
            correlationId: actor.correlationId,
            idempotencyKey: actor.idempotencyKey,
          });
        }
      }

      if (order.status !== transition.orderStatus) {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: transition.orderStatus,
            changedByUserId: user?.id ?? null,
            changedByEmployeeId: user?.employeeId ?? null,
            reason: recipientName
              ? `${actor.reasonPrefix}: ${this.actionLabel(action)}; qabul qilgan: ${recipientName}`
              : `${actor.reasonPrefix}: ${this.actionLabel(action)}`,
          },
        });
      }

      // Kitchen-originated cancellations bypass OrdersService, so create the
      // cancellation document here as part of the same state transition.
      if (
        transition.orderStatus === OrderStatus.CANCELLED &&
        order.status !== OrderStatus.CANCELLED
      ) {
        await ensureCancellationReceipt(
          tx,
          orderId,
          actor.cancellationReason ?? "Buyurtma oshxonada bekor qilindi",
        );
      }

      if (ticket.status !== transition.ticketStatus) {
        const updatedTicket = await tx.kitchenTicket.update({
          where: { id: ticket.id },
          data: {
            status: transition.ticketStatus,
            version: { increment: 1 },
            ...(transition.ticketStatus === KitchenTicketStatus.ACCEPTED ||
            transition.ticketStatus === KitchenTicketStatus.COOKING
              ? { acceptedAt: ticket.acceptedAt ?? now }
              : {}),
            ...(transition.ticketStatus === KitchenTicketStatus.COMPLETED ||
            transition.ticketStatus === KitchenTicketStatus.CANCELLED
              ? { completedAt: ticket.completedAt ?? now }
              : {}),
          },
        });
        await tx.kitchenTicketEvent.create({
          data: {
            ticketId: ticket.id,
            eventType: `KitchenTicket${this.actionEventSuffix(action)}`,
            previousStatus: ticket.status,
            newStatus: transition.ticketStatus,
            actorId: user?.id ?? null,
            reason:
              action === "cancel"
                ? (actor.cancellationReason ?? null)
                : recipientName
                  ? `${actor.reasonPrefix}: ${this.actionLabel(action)}; qabul qilgan: ${recipientName}`
                  : `${actor.reasonPrefix}: ${this.actionLabel(action)}`,
            correlationId: actor.correlationId ?? null,
            idempotencyKey: actor.idempotencyKey ?? null,
            payload: {
              action,
              reasonCode: actor.reasonCode ?? `KITCHEN_${action.toUpperCase()}`,
              ...(recipientName ? { recipientName } : {}),
            },
            version: updatedTicket.version,
          },
        });
      }

      const changed = {
        action,
        changed: true,
        order: await this.findOrderForTransition(tx, orderId, scope),
        ticket: await this.findTicketById(tx, ticket.id),
      };
      if (!changed.order || !changed.ticket) {
        throw new NotFoundException("Order or kitchen ticket not found");
      }

      const customerStatusCanBeSent =
        changed.order.status === OrderStatus.CONFIRMED ||
        changed.order.status === OrderStatus.PREPARING ||
        changed.order.status === OrderStatus.READY ||
        changed.order.status === OrderStatus.CANCELLED;
      if (
        action !== "complete" &&
        customerStatusCanBeSent &&
        changed.order.customerOrder?.customer?.telegramChatId
      ) {
        await tx.notificationOutbox.create({
          data: {
            tenantId: scope.tenantId,
            dedupeKey: `customer_status:${orderId}:${changed.ticket.version}`,
            kind: "customer_status",
            orderId,
            payload: { status: changed.order.status },
          },
        });
      }

      await tx.notificationOutbox.create({
        data: {
          tenantId: scope.tenantId,
          dedupeKey: `staff_status_refresh:kitchen:${orderId}:${changed.ticket.version}`,
          kind: "staff_status_refresh",
          orderId,
          payload: {
            status: changed.order.status,
            ticketStatus: changed.ticket.status,
          },
        },
      });

      await actor.completeIdempotency?.(tx, changed.ticket);
      return changed;
    });

    if (result.changed) {
      this.emitOrderStatusChanged({
        action,
        order: result.order,
        ticket: result.ticket,
      });
    }

    return result;
  }

  emitOrderCreated(payload: unknown): void {
    this.gateway.emitOrderCreated(payload);
  }

  emitOrderConfirmed(payload: unknown): void {
    this.gateway.emitOrderConfirmed(payload);
  }

  emitOrderSentToKitchen(payload: unknown): void {
    this.gateway.emitOrderSentToKitchen(payload);
  }

  emitOrderStatusChanged(payload: unknown): void {
    this.gateway.emitOrderStatusChanged(payload);
  }

  private resolveTransition(
    order: Pick<KitchenTransitionOrder, "status" | "type">,
    ticket: KitchenTransitionOrder["kitchenTickets"][number],
    action: KitchenStaffAction,
  ): {
    changed: boolean;
    orderStatus: OrderStatus;
    ticketStatus: KitchenTicketStatus;
  } {
    if (
      (action === "cancel" && order.status === OrderStatus.CANCELLED) ||
      (action === "complete" &&
        ticket.status === KitchenTicketStatus.COMPLETED &&
        order.status !== OrderStatus.CANCELLED)
    ) {
      return {
        changed: false,
        orderStatus: order.status,
        ticketStatus: ticket.status,
      };
    }
    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        order.status === OrderStatus.CANCELLED
          ? "Buyurtma bekor qilingan. Holat yangilandi."
          : "Buyurtma yakunlangan. Holat yangilandi.",
      );
    }

    if (
      ticket.status === KitchenTicketStatus.COMPLETED ||
      ticket.status === KitchenTicketStatus.CANCELLED
    ) {
      throw new BadRequestException("Oshxona chiptasi yopilgan");
    }

    if (action === "accept") {
      if (
        order.status === OrderStatus.CONFIRMED &&
        ticket.status === KitchenTicketStatus.ACCEPTED
      ) {
        return {
          changed: false,
          orderStatus: OrderStatus.CONFIRMED,
          ticketStatus: KitchenTicketStatus.ACCEPTED,
        };
      }

      if (
        (order.status === OrderStatus.NEW ||
          order.status === OrderStatus.CONFIRMED) &&
        ticket.status === KitchenTicketStatus.NEW
      ) {
        return {
          changed: true,
          orderStatus: OrderStatus.CONFIRMED,
          ticketStatus: KitchenTicketStatus.ACCEPTED,
        };
      }
    }

    if (action === "start_preparing") {
      if (
        order.status === OrderStatus.PREPARING &&
        ticket.status === KitchenTicketStatus.COOKING
      ) {
        return {
          changed: false,
          orderStatus: OrderStatus.PREPARING,
          ticketStatus: KitchenTicketStatus.COOKING,
        };
      }

      if (
        order.status === OrderStatus.CONFIRMED &&
        ticket.status === KitchenTicketStatus.ACCEPTED
      ) {
        return {
          changed: true,
          orderStatus: OrderStatus.PREPARING,
          ticketStatus: KitchenTicketStatus.COOKING,
        };
      }
    }

    if (action === "mark_ready") {
      if (
        order.status === OrderStatus.READY &&
        ticket.status === KitchenTicketStatus.READY
      ) {
        return {
          changed: false,
          orderStatus: OrderStatus.READY,
          ticketStatus: KitchenTicketStatus.READY,
        };
      }

      if (
        order.status === OrderStatus.PREPARING &&
        ticket.status === KitchenTicketStatus.COOKING
      ) {
        return {
          changed: true,
          orderStatus: OrderStatus.READY,
          ticketStatus: KitchenTicketStatus.READY,
        };
      }
    }

    if (action === "complete") {
      if (ticket.status === KitchenTicketStatus.READY) {
        return {
          changed: true,
          orderStatus: orderStatusAfterKitchenHandoff(order.type),
          ticketStatus: KitchenTicketStatus.COMPLETED,
        };
      }
    }

    if (action === "cancel") {
      if (
        (order.status === OrderStatus.NEW ||
          order.status === OrderStatus.CONFIRMED ||
          order.status === OrderStatus.PREPARING) &&
        (ticket.status === KitchenTicketStatus.NEW ||
          ticket.status === KitchenTicketStatus.ACCEPTED ||
          ticket.status === KitchenTicketStatus.COOKING)
      ) {
        return {
          changed: true,
          orderStatus: OrderStatus.CANCELLED,
          ticketStatus: KitchenTicketStatus.CANCELLED,
        };
      }
    }

    throw new BadRequestException("Bu statusdan bunday amal bajarib bo'lmaydi");
  }

  private async findOrderForTransition(
    tx: TransactionClient,
    orderId: string,
    scope: { tenantId: string; branchId?: string | undefined },
  ): Promise<KitchenTransitionOrder | null> {
    return tx.order.findFirst({
      where: {
        id: orderId,
        ...(scope.branchId
          ? { branchId: scope.branchId }
          : { branch: { tenantId: scope.tenantId } }),
      },
      select: {
        id: true,
        branchId: true,
        type: true,
        status: true,
        orderState: true,
        version: true,
        paymentStatus: true,
        total: true,
        customerOrder: {
          select: {
            paymentMethod: true,
            customer: { select: { telegramChatId: true } },
          },
        },
        payments: { select: { amount: true, status: true } },
        acceptedAt: true,
        acceptedById: true,
        cancelledAt: true,
        cancellationReason: true,
        kitchenTickets: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            orderId: true,
            status: true,
            version: true,
            acceptedAt: true,
            completedAt: true,
          },
        },
      },
    });
  }

  private async findTicketById(tx: TransactionClient, id: string) {
    const ticket = await tx.kitchenTicket.findUnique({
      where: { id },
      include: this.ticketInclude(),
    });

    if (!ticket) {
      throw new NotFoundException("Oshxona chiptasi topilmadi");
    }

    return ticket;
  }

  private actionLabel(action: KitchenStaffAction): string {
    const labels: Record<KitchenStaffAction, string> = {
      accept: "Qabul qilindi",
      start_preparing: "Tayyorlanmoqda",
      mark_ready: "Tayyor",
      complete: "Yopildi",
      cancel: "Bekor qilindi",
    };

    return labels[action];
  }

  private actionEventSuffix(action: KitchenStaffAction): string {
    const suffixes: Record<KitchenStaffAction, string> = {
      accept: "Accepted",
      start_preparing: "PreparationStarted",
      mark_ready: "MarkedReady",
      complete: "HandedOff",
      cancel: "Cancelled",
    };
    return suffixes[action];
  }

  private ticketInclude() {
    return {
      items: {
        where: { status: OrderItemStatus.ACTIVE },
        orderBy: { createdAt: "asc" },
      },
      events: { orderBy: { version: "asc" } },
      order: {
        include: {
          branch: true,
          table: { include: { hall: true } },
          waiter: true,
          customerOrder: {
            select: {
              paymentMethod: true,
              customer: { select: { name: true } },
            },
          },
          payments: { select: { amount: true, status: true } },
          statusHistory: {
            orderBy: { createdAt: "asc" },
            include: {
              changedByEmployee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeCode: true,
                },
              },
              changedByUser: {
                select: { id: true, displayName: true, email: true },
              },
            },
          },
          items: {
            where: { status: OrderItemStatus.ACTIVE },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    } satisfies Prisma.KitchenTicketInclude;
  }

  private historySelect() {
    return {
      id: true,
      ticketNumber: true,
      status: true,
      priority: true,
      version: true,
      revisionNumber: true,
      isSupplement: true,
      createdAt: true,
      acceptedAt: true,
      items: {
        where: { status: OrderItemStatus.ACTIVE },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          productName: true,
          variantName: true,
          quantity: true,
          notes: true,
          modifierSnapshot: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          displayOrderNumber: true,
          source: true,
          type: true,
          notes: true,
          kitchenComment: true,
          branch: { select: { name: true } },
          table: { select: { number: true, name: true } },
          statusHistory: {
            select: { toStatus: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
          items: {
            where: { status: OrderItemStatus.ACTIVE },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              productName: true,
              variantName: true,
              quantity: true,
              notes: true,
              modifierSnapshot: true,
            },
          },
        },
      },
    } satisfies Prisma.KitchenTicketSelect;
  }

  private requireEmployee(user: AuthenticatedUser): string {
    if (!user.employeeId) {
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    return user.employeeId;
  }

  private todayTashkentRange(): { start: Date; end: Date } {
    const offsetMs = 5 * 60 * 60 * 1000;
    const shifted = new Date(Date.now() + offsetMs);
    const startUtcMs =
      Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate(),
      ) - offsetMs;

    return {
      start: new Date(startUtcMs),
      end: new Date(startUtcMs + 24 * 60 * 60 * 1000),
    };
  }

  private toKitchenTicketStatus(
    status?: string,
  ): KitchenTicketStatus | undefined {
    return Object.values(KitchenTicketStatus).includes(
      status as KitchenTicketStatus,
    )
      ? (status as KitchenTicketStatus)
      : undefined;
  }

  private parseLimit(value?: string): number {
    const parsed = Number(value ?? 50);
    return Number.isFinite(parsed)
      ? Math.min(100, Math.max(1, Math.trunc(parsed)))
      : 50;
  }

  private parseOffset(value?: string): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  }

  private createTicketNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll("-", "");
    return `KDS-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private isUniqueTicketError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}
