import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { KitchenTicketStatus, OrderItemStatus, OrderStatus, Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { KitchenGateway } from "./kitchen.gateway";

type TransactionClient = Prisma.TransactionClient;
export type KitchenStaffAction = "accept" | "start_preparing" | "mark_ready" | "complete" | "cancel";
type KitchenTransitionActor = {
  user?: AuthenticatedUser;
  reasonPrefix: string;
  cancellationReason?: string;
};
type KitchenTransitionOrder = {
  id: string;
  branchId: string;
  status: OrderStatus;
  acceptedAt: Date | null;
  acceptedById: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
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

  listOrders(user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);

    return this.prisma.kitchenTicket.findMany({
      where: {
        ...(branchId ? { order: { branchId } } : {}),
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
    });
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

  async applyTicketAction(id: string, action: KitchenStaffAction, user: AuthenticatedUser) {
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

  async applyOrderAction(orderId: string, action: KitchenStaffAction, actor: KitchenTransitionActor) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;

      const order = await this.findOrderForTransition(tx, orderId);

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      if (actor.user) {
        resolveBranchScope(actor.user, order.branchId);
      }

      const ticket = order.kitchenTickets[0] ?? null;

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
      const orderData: Prisma.OrderUpdateInput = {};
      const user = actor.user;

      if (order.status !== transition.orderStatus) {
        orderData.status = transition.orderStatus;
      }

      if (transition.orderStatus === OrderStatus.CONFIRMED && !order.acceptedAt) {
        orderData.acceptedAt = now;

        if (user?.employeeId && !order.acceptedById) {
          orderData.acceptedBy = { connect: { id: user.employeeId } };
        }
      }

      if (transition.orderStatus === OrderStatus.CANCELLED) {
        orderData.cancelledAt = order.cancelledAt ?? now;
        orderData.cancellationReason = order.cancellationReason ?? actor.cancellationReason ?? null;

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
      this.emitOrderStatusChanged({ action, order: result.order, ticket: result.ticket });
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
    order: Pick<KitchenTransitionOrder, "status">,
    ticket: KitchenTransitionOrder["kitchenTickets"][number],
    action: KitchenStaffAction,
  ): { changed: boolean; orderStatus: OrderStatus; ticketStatus: KitchenTicketStatus } {
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(`Buyurtma allaqachon ${order.status.toLowerCase()}`);
    }

    if (ticket.status === KitchenTicketStatus.COMPLETED || ticket.status === KitchenTicketStatus.CANCELLED) {
      throw new BadRequestException("Oshxona chiptasi yopilgan");
    }

    if (action === "accept") {
      if (order.status === OrderStatus.CONFIRMED && ticket.status === KitchenTicketStatus.ACCEPTED) {
        return { changed: false, orderStatus: OrderStatus.CONFIRMED, ticketStatus: KitchenTicketStatus.ACCEPTED };
      }

      if (
        (order.status === OrderStatus.NEW || order.status === OrderStatus.CONFIRMED) &&
        ticket.status === KitchenTicketStatus.NEW
      ) {
        return { changed: true, orderStatus: OrderStatus.CONFIRMED, ticketStatus: KitchenTicketStatus.ACCEPTED };
      }
    }

    if (action === "start_preparing") {
      if (order.status === OrderStatus.PREPARING && ticket.status === KitchenTicketStatus.COOKING) {
        return { changed: false, orderStatus: OrderStatus.PREPARING, ticketStatus: KitchenTicketStatus.COOKING };
      }

      if (order.status === OrderStatus.CONFIRMED && ticket.status === KitchenTicketStatus.ACCEPTED) {
        return { changed: true, orderStatus: OrderStatus.PREPARING, ticketStatus: KitchenTicketStatus.COOKING };
      }
    }

    if (action === "mark_ready") {
      if (order.status === OrderStatus.READY && ticket.status === KitchenTicketStatus.READY) {
        return { changed: false, orderStatus: OrderStatus.READY, ticketStatus: KitchenTicketStatus.READY };
      }

      if (order.status === OrderStatus.PREPARING && ticket.status === KitchenTicketStatus.COOKING) {
        return { changed: true, orderStatus: OrderStatus.READY, ticketStatus: KitchenTicketStatus.READY };
      }
    }

    if (action === "complete") {
      if (ticket.status === KitchenTicketStatus.READY) {
        return { changed: true, orderStatus: OrderStatus.READY, ticketStatus: KitchenTicketStatus.COMPLETED };
      }
    }

    if (action === "cancel") {
      if (
        (order.status === OrderStatus.NEW || order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.PREPARING) &&
        (ticket.status === KitchenTicketStatus.NEW ||
          ticket.status === KitchenTicketStatus.ACCEPTED ||
          ticket.status === KitchenTicketStatus.COOKING)
      ) {
        return { changed: true, orderStatus: OrderStatus.CANCELLED, ticketStatus: KitchenTicketStatus.CANCELLED };
      }
    }

    throw new BadRequestException("Bu statusdan bunday amal bajarib bo'lmaydi");
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
        status: true,
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
          items: {
            where: { status: OrderItemStatus.ACTIVE },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    } satisfies Prisma.KitchenTicketInclude;
  }

  private createTicketNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll("-", "");
    return `KDS-${date}-${randomInt(1000, 10000)}`;
  }

  private isUniqueTicketError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
