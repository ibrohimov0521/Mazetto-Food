import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { KitchenTicketStatus, OrderItemStatus, OrderStatus, Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { KitchenGateway } from "./kitchen.gateway";

type TransactionClient = Prisma.TransactionClient;

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
    const ticket = await this.prisma.$transaction(async (tx) => {
      await this.assertTicketCanMove(tx, id, [KitchenTicketStatus.NEW, KitchenTicketStatus.ACCEPTED], user);

      return tx.kitchenTicket.update({
        where: { id },
        data: {
          status: KitchenTicketStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
        include: this.ticketInclude(),
      });
    });

    this.emitOrderStatusChanged({ ticket, userId: user.id });
    return ticket;
  }

  async startTicket(id: string, user: AuthenticatedUser) {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const current = await this.assertTicketCanMove(tx, id, [
        KitchenTicketStatus.NEW,
        KitchenTicketStatus.ACCEPTED,
        KitchenTicketStatus.COOKING,
      ], user);

      await this.updateLinkedOrderStatus(
        tx,
        current.orderId,
        OrderStatus.PREPARING,
        user,
        "Kitchen started cooking",
      );

      return tx.kitchenTicket.update({
        where: { id },
        data: {
          status: KitchenTicketStatus.COOKING,
          acceptedAt: current.acceptedAt ?? new Date(),
        },
        include: this.ticketInclude(),
      });
    });

    this.emitOrderStatusChanged({ ticket, userId: user.id });
    return ticket;
  }

  async readyTicket(id: string, user: AuthenticatedUser) {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const current = await this.assertTicketCanMove(tx, id, [
        KitchenTicketStatus.ACCEPTED,
        KitchenTicketStatus.COOKING,
        KitchenTicketStatus.READY,
      ], user);

      await this.updateLinkedOrderStatus(
        tx,
        current.orderId,
        OrderStatus.READY,
        user,
        "Kitchen marked order ready",
      );

      return tx.kitchenTicket.update({
        where: { id },
        data: {
          status: KitchenTicketStatus.READY,
          acceptedAt: current.acceptedAt ?? new Date(),
        },
        include: this.ticketInclude(),
      });
    });

    this.emitOrderStatusChanged({ ticket, userId: user.id });
    return ticket;
  }

  async completeTicket(id: string, user: AuthenticatedUser) {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const current = await this.assertTicketCanMove(tx, id, [
        KitchenTicketStatus.READY,
        KitchenTicketStatus.COMPLETED,
      ], user);

      await this.updateLinkedOrderStatus(
        tx,
        current.orderId,
        OrderStatus.READY,
        user,
        "Kitchen completed ticket",
      );

      return tx.kitchenTicket.update({
        where: { id },
        data: {
          status: KitchenTicketStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: this.ticketInclude(),
      });
    });

    this.emitOrderStatusChanged({ ticket, userId: user.id });
    return ticket;
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

  private async assertTicketCanMove(
    tx: TransactionClient,
    id: string,
    allowedStatuses: KitchenTicketStatus[],
    user: AuthenticatedUser,
  ) {
    const ticket = await tx.kitchenTicket.findUnique({
      where: { id },
      select: {
        id: true,
        orderId: true,
        status: true,
        acceptedAt: true,
        order: { select: { status: true, branchId: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException("Kitchen ticket not found");
    }

    if (!allowedStatuses.includes(ticket.status)) {
      throw new BadRequestException(`Kitchen ticket cannot move from ${ticket.status}`);
    }

    resolveBranchScope(user, ticket.order.branchId);

    if (ticket.order.status === OrderStatus.COMPLETED || ticket.order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException("Completed or cancelled orders cannot change kitchen status");
    }

    return ticket;
  }

  private async updateLinkedOrderStatus(
    tx: TransactionClient,
    orderId: string,
    nextStatus: OrderStatus,
    user: AuthenticatedUser,
    reason: string,
  ): Promise<void> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (order.status === nextStatus) {
      return;
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: nextStatus },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: nextStatus,
        changedByUserId: user.id,
        changedByEmployeeId: user.employeeId ?? null,
        reason,
      },
    });
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
