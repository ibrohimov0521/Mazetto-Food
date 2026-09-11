import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CashTransactionType,
  KitchenTicketStatus,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { randomInt } from "node:crypto";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import {
  kitchenEvents,
  kitchenOrderStatusChangedEvent,
} from "./kitchen-events";
import { KitchenGateway } from "./kitchen.gateway";
import {
  kitchenStatusForOrder,
  orderStatusAfterKitchenHandoff,
  syncKitchenTickets,
} from "./kitchen-status-sync";

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
  suppressTelegramStaffRefresh?: boolean;
};
type KitchenTransitionOrder = {
  id: string;
  branchId: string;
  type: OrderType;
  status: OrderStatus;
  acceptedAt: Date | null;
  acceptedById: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  paymentStatus: PaymentStatus;
  total: Prisma.Decimal;
  payments: { amount: Prisma.Decimal; status: PaymentStatus }[];
  customerOrder: { paymentMethod: string | null } | null;
  kitchenTickets: {
    id: string;
    orderId: string;
    status: KitchenTicketStatus;
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
    this.requireEmployee(user);
    const branchId = resolveBranchScope(user);
    const day = this.todayTashkentRange();

    const tickets = await this.prisma.kitchenTicket.findMany({
      where: {
        order: {
          ...(branchId ? { branchId } : {}),
          createdAt: { gte: day.start, lt: day.end },
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
      },
      include: this.ticketInclude(),
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 250,
    });
    return tickets.map((ticket) => ({
      ...ticket,
      status: kitchenStatusForOrder(ticket.order.status) ?? ticket.status,
    }));
  }

  async listHistory(
    query: { status?: string; search?: string; limit?: string; offset?: string },
    user: AuthenticatedUser,
  ) {
    const employeeId = this.requireEmployee(user);
    const branchId = resolveBranchScope(user);
    const day = this.todayTashkentRange();
    const status = this.toKitchenTicketStatus(query.status);
    const search = query.search?.trim();

    const tickets = await this.prisma.kitchenTicket.findMany({
      where: {
        ...(status ? { status } : {}),
        order: {
          ...(branchId ? { branchId } : {}),
          createdAt: { gte: day.start, lt: day.end },
          statusHistory: {
            some: {
              changedByEmployeeId: employeeId,
              createdAt: { gte: day.start, lt: day.end },
            },
          },
          ...(search
            ? {
                OR: [
                  { orderNumber: { contains: search, mode: "insensitive" } },
                  { displayOrderNumber: { contains: search, mode: "insensitive" } },
                  { customerName: { contains: search, mode: "insensitive" } },
                  { customerPhone: { contains: search, mode: "insensitive" } },
                  { items: { some: { productName: { contains: search, mode: "insensitive" } } } },
                ],
              }
            : {}),
        },
      },
      include: this.ticketInclude(),
      orderBy: { updatedAt: "desc" },
      skip: this.parseOffset(query.offset),
      take: this.parseLimit(query.limit),
    });

    return tickets.map((ticket) => ({
      ...ticket,
      status: kitchenStatusForOrder(ticket.order.status) ?? ticket.status,
    }));
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

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await tx.kitchenTicket.create({
          data: {
            orderId,
            ticketNumber: this.createTicketNumber(),
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

  async cancelTicket(id: string, user: AuthenticatedUser) {
    const result = await this.applyTicketAction(id, "cancel", user);
    return result.ticket;
  }

  async applyTicketAction(
    id: string,
    action: KitchenStaffAction,
    user: AuthenticatedUser,
  ) {
    const existingTicket = await this.prisma.kitchenTicket.findUnique({
      where: { id },
      select: { orderId: true },
    });

    if (!existingTicket) {
      throw new NotFoundException("Oshxona chiptasi topilmadi");
    }

    return this.applyOrderAction(existingTicket.orderId, action, {
      user,
      reasonPrefix: "Kitchen UI",
      cancellationReason: "Kitchen UI orqali bekor qilindi",
    });
  }

  async applyOrderAction(
    orderId: string,
    action: KitchenStaffAction,
    actor: KitchenTransitionActor,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;

      const order = await this.findOrderForTransition(tx, orderId);

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      if (actor.user) {
        resolveBranchScope(actor.user, order.branchId);
      }

      await syncKitchenTickets(tx, orderId, order.status);
      const storedTicket = order.kitchenTickets[0] ?? null;
      const ticket =
        storedTicket &&
        ![
          KitchenTicketStatus.COMPLETED,
          KitchenTicketStatus.CANCELLED,
        ].includes(storedTicket.status as "COMPLETED" | "CANCELLED")
          ? {
              ...storedTicket,
              status:
                kitchenStatusForOrder(order.status) ?? storedTicket.status,
            }
          : storedTicket;

      if (!ticket) {
        throw new BadRequestException("Oshxona chiptasi topilmadi");
      }

      const transition = this.resolveTransition(order, ticket, action);

      if (!transition.changed) {
        return {
          action,
          changed: false,
          order: await this.findOrderForTransition(tx, orderId),
          ticket: await this.findTicketById(tx, ticket.id),
        };
      }

      const now = new Date();
      if (
        transition.orderStatus === OrderStatus.SERVED &&
        order.type === OrderType.TAKEAWAY &&
        order.customerOrder?.paymentMethod?.toUpperCase() === "CASH"
      ) {
        await this.capturePickupCash(tx, order, actor.user, now);
      }

      const orderData: Prisma.OrderUpdateInput = {};
      const user = actor.user;

      if (order.status !== transition.orderStatus) {
        orderData.status = transition.orderStatus;
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

      if (Object.keys(orderData).length > 0) {
        await tx.order.update({ where: { id: orderId }, data: orderData });
      }

      if (order.status !== transition.orderStatus) {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: transition.orderStatus,
            changedByUserId: user?.id ?? null,
            changedByEmployeeId: user?.employeeId ?? null,
            reason: `${actor.reasonPrefix}: ${this.actionLabel(action)}`,
          },
        });
      }

      if (ticket.status !== transition.ticketStatus) {
        await tx.kitchenTicket.update({
          where: { id: ticket.id },
          data: {
            status: transition.ticketStatus,
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
      }

      return {
        action,
        changed: true,
        order: await this.findOrderForTransition(tx, orderId),
        ticket: await this.findTicketById(tx, ticket.id),
      };
    });

    if (result.changed) {
      this.emitOrderStatusChanged({
        action,
        order: result.order,
        ticket: result.ticket,
      });
      if (!actor.suppressTelegramStaffRefresh) {
        kitchenEvents.emit(kitchenOrderStatusChangedEvent, { action, orderId });
      }
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

  private async capturePickupCash(
    tx: TransactionClient,
    order: Pick<
      KitchenTransitionOrder,
      "id" | "branchId" | "paymentStatus" | "total" | "payments"
    >,
    actor: AuthenticatedUser | undefined,
    occurredAt: Date,
  ): Promise<void> {
    const successfulStatuses: PaymentStatus[] = [
      PaymentStatus.PAID,
      PaymentStatus.SUCCESS,
    ];
    const paidTotal = order.payments
      .filter((payment) => successfulStatuses.includes(payment.status))
      .reduce(
        (total, payment) => total.add(payment.amount),
        new Prisma.Decimal(0),
      );
    const outstanding = order.total.sub(paidTotal);
    if (outstanding.lessThanOrEqualTo(0)) {
      return;
    }

    if (!actor?.employeeId) {
      throw new ForbiddenException(
        "Pickup cash requires an employee-linked account",
      );
    }

    const shift = await tx.shift.findFirst({
      where: {
        branchId: order.branchId,
        employeeId: actor.employeeId,
        status: "OPEN",
      },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    });
    if (!shift) {
      throw new BadRequestException(
        "Open employee shift is required before accepting pickup cash",
      );
    }

    const branchCashMethod = await tx.paymentMethod.findFirst({
      where: {
        branchId: order.branchId,
        code: "CASH",
        isActive: true,
      },
    });
    const cashMethod =
      branchCashMethod ??
      (await tx.paymentMethod.findFirst({
        where: { branchId: null, code: "CASH", isActive: true },
      }));
    if (!cashMethod) {
      throw new BadRequestException("Cash payment method is not available");
    }

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        paymentMethodId: cashMethod.id,
        acceptedById: actor.employeeId,
        createdById: actor.id,
        amount: outstanding,
        status: PaymentStatus.PAID,
        methodCode: cashMethod.code,
        reference: "Pickup cash at kitchen handoff",
        paidAt: occurredAt,
      },
    });

    await tx.revenueRecord.create({
      data: {
        branchId: order.branchId,
        orderId: order.id,
        paymentId: payment.id,
        shiftId: shift.id,
        employeeId: actor.employeeId,
        source: "ORDER",
        amount: outstanding,
        description: "Pickup cash payment",
        recordedAt: occurredAt,
      },
    });

    await tx.cashTransaction.create({
      data: {
        branchId: order.branchId,
        shiftId: shift.id,
        employeeId: actor.employeeId,
        orderId: order.id,
        paymentId: payment.id,
        type: CashTransactionType.SALE,
        amount: outstanding,
        reason: "Pickup cash received at kitchen handoff",
        createdById: actor.id,
        occurredAt,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.PAID },
    });
  }

  private async findOrderForTransition(
    tx: TransactionClient,
    orderId: string,
  ): Promise<KitchenTransitionOrder | null> {
    return tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        branchId: true,
        type: true,
        status: true,
        paymentStatus: true,
        total: true,
        customerOrder: { select: { paymentMethod: true } },
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

  private ticketInclude() {
    return {
      order: {
        include: {
          branch: true,
          table: { include: { hall: true } },
          waiter: true,
          statusHistory: {
            orderBy: { createdAt: "asc" },
            include: {
              changedByEmployee: {
                select: { id: true, firstName: true, lastName: true, employeeCode: true },
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

  private requireEmployee(user: AuthenticatedUser): string {
    if (!user.employeeId) {
      throw new ForbiddenException("Authenticated user is not linked to an employee");
    }

    return user.employeeId;
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

  private toKitchenTicketStatus(status?: string): KitchenTicketStatus | undefined {
    return Object.values(KitchenTicketStatus).includes(status as KitchenTicketStatus)
      ? (status as KitchenTicketStatus)
      : undefined;
  }

  private parseLimit(value?: string): number {
    const parsed = Number(value ?? 50);
    return Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.trunc(parsed))) : 50;
  }

  private parseOffset(value?: string): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  }

  private createTicketNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll("-", "");
    return `KDS-${date}-${randomInt(1000, 10000)}`;
  }

  private isUniqueTicketError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}
