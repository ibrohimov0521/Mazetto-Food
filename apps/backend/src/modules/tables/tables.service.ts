import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderSource, OrderStatus, OrderType, Prisma, TableStatus } from "@prisma/client";
import { randomInt } from "node:crypto";
import { resolveBranchScope, resolveRequiredBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { KitchenService } from "../kitchen/kitchen.service";
import type { CreateHallDto, CreateTableDto, CreateTableOrderDto, UpdateTableStatusDto } from "./dto/tables.dto";

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenService: KitchenService,
  ) {}

  async listTables(branchId: string | undefined, user: AuthenticatedUser) {
    const scopedBranchId = resolveBranchScope(user, branchId);

    return this.prisma.restaurantTable.findMany({
      where: {
        isActive: true,
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
      },
      include: {
        hall: true,
        orders: {
          where: {
            status: { in: [OrderStatus.NEW, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED] },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { items: true },
        },
      },
      orderBy: [{ hall: { sortOrder: "asc" } }, { sortOrder: "asc" }, { number: "asc" }],
    });
  }

  async getTable(id: string, user: AuthenticatedUser) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id },
      include: {
        hall: true,
        orders: {
          where: {
            status: { in: [OrderStatus.NEW, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED] },
          },
          include: { items: true, waiter: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!table) {
      throw new NotFoundException("Table not found");
    }

    resolveBranchScope(user, table.branchId);

    return table;
  }

  async createHall(dto: CreateHallDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);

    return this.prisma.hall.create({
      data: {
        branchId,
        code: this.createCode(dto.name),
        name: dto.name,
        description: dto.description ?? null,
      },
    });
  }

  async createTable(dto: CreateTableDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);

    return this.prisma.restaurantTable.create({
      data: {
        branchId,
        hallId: dto.hallId,
        code: `T${dto.number}-${Date.now().toString(36).toUpperCase()}`,
        number: dto.number,
        name: dto.name,
        capacity: dto.capacity,
        seats: dto.capacity,
        sortOrder: dto.number,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateTableStatusDto, user: AuthenticatedUser) {
    await this.assertTable(id, user);

    return this.prisma.restaurantTable.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async createOrderForTable(id: string, dto: CreateTableOrderDto, user: AuthenticatedUser) {
    const waiterId = this.requireEmployee(user);

    const order = await this.prisma.$transaction(async (tx) => {
      const table = await tx.restaurantTable.findUnique({ where: { id } });

      if (!table?.isActive) {
        throw new NotFoundException("Table not found");
      }

      await this.assertEmployeeInBranch(tx, waiterId, table.branchId);
      resolveBranchScope(user, table.branchId);

      if (table.status === TableStatus.CLEANING || table.status === TableStatus.RESERVED) {
        throw new BadRequestException("Table is not available for a new order");
      }

      const existingOrder = await tx.order.findFirst({
        where: {
          tableId: id,
          status: { in: [OrderStatus.NEW, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED] },
        },
      });

      if (existingOrder) {
        throw new BadRequestException("Table already has an active order");
      }

      const order = await tx.order.create({
        data: {
          branchId: table.branchId,
          tableId: id,
          waiterId,
          createdById: waiterId,
          orderNumber: this.createOrderNumber(),
          source: OrderSource.POS,
          type: dto.type ?? OrderType.DINE_IN,
          status: OrderStatus.NEW,
          guestCount: dto.guestCount ?? null,
          notes: dto.notes ?? null,
        },
      });

      await tx.restaurantTable.update({
        where: { id },
        data: { status: TableStatus.OCCUPIED },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          toStatus: OrderStatus.NEW,
          changedByUserId: user.id,
          changedByEmployeeId: waiterId,
          reason: "Waiter opened table order",
        },
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: { table: true, items: true },
      });
    });

    this.kitchenService.emitOrderCreated(order);
    return order;
  }

  async listWaiterOrders(user: AuthenticatedUser) {
    const waiterId = this.requireEmployee(user);

    return this.prisma.order.findMany({
      where: {
        waiterId,
        status: { in: [OrderStatus.NEW, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED] },
      },
      include: { table: true, items: true },
      orderBy: { createdAt: "desc" },
    });
  }

  private requireEmployee(user: AuthenticatedUser): string {
    if (!user.employeeId) {
      throw new ForbiddenException("Authenticated user is not linked to an employee");
    }

    return user.employeeId;
  }

  private async assertTable(id: string, user: AuthenticatedUser): Promise<void> {
    const table = await this.prisma.restaurantTable.findUnique({ where: { id }, select: { id: true, branchId: true } });

    if (!table) {
      throw new NotFoundException("Table not found");
    }

    resolveBranchScope(user, table.branchId);
  }

  private async assertEmployeeInBranch(tx: Prisma.TransactionClient, employeeId: string, branchId: string): Promise<void> {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, branchId, status: "ACTIVE" },
    });

    if (!employee) {
      throw new ForbiddenException("Employee is not active in this branch");
    }
  }

  private createCode(value: string): string {
    return `${value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${Date.now().toString(36).toUpperCase()}`;
  }

  private createOrderNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll("-", "");
    const time = now.toISOString().slice(11, 19).replaceAll(":", "");

    return `WTR-${date}-${time}-${randomInt(1000, 10000)}`;
  }
}
