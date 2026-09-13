import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OrderSource,
  OrderStatus,
  OrderType,
  Prisma,
  TableStatus,
} from "@prisma/client";
import { randomInt } from "node:crypto";
import {
  resolveBranchScope,
  resolveRequiredBranchScope,
} from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { KitchenService } from "../kitchen/kitchen.service";
import { allocateDisplayOrderNumber } from "../orders/order-display-number";
import type {
  CreateHallDto,
  CreateTableDto,
  CreateTableOrderDto,
  UpdateHallDto,
  UpdateTableDto,
  UpdateTableStatusDto,
} from "./dto/tables.dto";

const activeOrderStatuses: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
];

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenService: KitchenService,
  ) {}

  async listHalls(branchId: string | undefined, user: AuthenticatedUser) {
    const scopedBranchId = resolveBranchScope(user, branchId);

    return this.prisma.hall.findMany({
      where: {
        isActive: true,
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
      },
      select: {
        id: true,
        branchId: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        sortOrder: true,
        _count: { select: { tables: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async getHall(id: string, user: AuthenticatedUser) {
    const hall = await this.prisma.hall.findUnique({
      where: { id },
      include: {
        branch: {
          select: { id: true, code: true, name: true, isActive: true },
        },
        tables: {
          where: { isActive: true },
          include: {
            orders: {
              where: { status: { in: activeOrderStatuses } },
              select: { id: true },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
        },
      },
    });

    if (!hall) {
      throw new NotFoundException("Hall not found");
    }

    resolveBranchScope(user, hall.branchId);
    return hall;
  }

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
            status: { in: activeOrderStatuses },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { items: true },
        },
      },
      orderBy: [
        { hall: { sortOrder: "asc" } },
        { sortOrder: "asc" },
        { number: "asc" },
      ],
    });
  }

  async getTable(id: string, user: AuthenticatedUser) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        hall: true,
        orders: {
          where: {
            status: { in: activeOrderStatuses },
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
    await this.assertBranch(branchId);
    const name = dto.name.trim();

    return this.prisma.hall.create({
      data: {
        branchId,
        code: this.createCode(name),
        name,
        description: dto.description?.trim() || null,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async createTable(dto: CreateTableDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);
    const hall = await this.prisma.hall.findFirst({
      where: { id: dto.hallId, branchId, isActive: true },
      select: { id: true },
    });

    if (!hall) {
      throw new BadRequestException(
        "Selected hall is not active in this branch",
      );
    }

    const duplicate = await this.prisma.restaurantTable.findFirst({
      where: { hallId: dto.hallId, number: dto.number, isActive: true },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException("A table with this number already exists");
    }

    return this.prisma.restaurantTable.create({
      data: {
        branchId,
        hallId: dto.hallId,
        code: `T${dto.number}-${Date.now().toString(36).toUpperCase()}`,
        number: dto.number,
        name: dto.name.trim(),
        capacity: dto.capacity,
        seats: dto.capacity,
        sortOrder: dto.sortOrder ?? dto.number,
      },
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateTableStatusDto,
    user: AuthenticatedUser,
  ) {
    await this.assertTable(id, user);

    return this.prisma.restaurantTable.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async updateHall(id: string, dto: UpdateHallDto, user: AuthenticatedUser) {
    await this.assertHall(id, user);

    if (dto.isActive === false) {
      const activeTable = await this.prisma.restaurantTable.findFirst({
        where: { hallId: id, isActive: true },
        select: { name: true },
      });

      if (activeTable) {
        throw new BadRequestException(
          `Archive ${activeTable.name} before archiving this hall`,
        );
      }
    }

    return this.prisma.hall.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async updateTable(id: string, dto: UpdateTableDto, user: AuthenticatedUser) {
    const table = await this.assertTable(id, user);

    if (dto.number !== undefined && table.hallId) {
      const duplicate = await this.prisma.restaurantTable.findFirst({
        where: {
          hallId: table.hallId,
          number: dto.number,
          isActive: true,
          id: { not: id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException("A table with this number already exists");
      }
    }

    if (dto.isActive === false) {
      const activeOrder = await this.prisma.order.findFirst({
        where: { tableId: id, status: { in: activeOrderStatuses } },
        select: { id: true },
      });

      if (activeOrder) {
        throw new BadRequestException(
          "A table with an active order cannot be archived",
        );
      }
    }

    return this.prisma.restaurantTable.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.capacity !== undefined
          ? { capacity: dto.capacity, seats: dto.capacity }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async createOrderForTable(
    id: string,
    dto: CreateTableOrderDto,
    user: AuthenticatedUser,
  ) {
    const waiterId = this.requireEmployee(user);

    const order = await this.prisma.$transaction(async (tx) => {
      const table = await tx.restaurantTable.findUnique({ where: { id } });

      if (!table?.isActive) {
        throw new NotFoundException("Table not found");
      }

      await this.assertEmployeeInBranch(tx, waiterId, table.branchId);
      resolveBranchScope(user, table.branchId);

      if (
        table.status === TableStatus.CLEANING ||
        table.status === TableStatus.RESERVED
      ) {
        throw new BadRequestException("Table is not available for a new order");
      }

      const existingOrder = await tx.order.findFirst({
        where: {
          tableId: id,
          status: { in: activeOrderStatuses },
        },
      });

      if (existingOrder) {
        throw new BadRequestException("Table already has an active order");
      }

      const displayOrder = await allocateDisplayOrderNumber(
        tx,
        OrderSource.POS,
      );
      const order = await tx.order.create({
        data: {
          branchId: table.branchId,
          tableId: id,
          waiterId,
          createdById: waiterId,
          orderNumber: this.createOrderNumber(),
          ...displayOrder,
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
        status: {
          in: activeOrderStatuses,
        },
      },
      include: { table: true, items: true },
      orderBy: { createdAt: "desc" },
    });
  }

  private requireEmployee(user: AuthenticatedUser): string {
    if (!user.employeeId) {
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    return user.employeeId;
  }

  private async assertTable(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ id: string; branchId: string; hallId: string | null }> {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id },
      select: { id: true, branchId: true, hallId: true },
    });

    if (!table) {
      throw new NotFoundException("Table not found");
    }

    resolveBranchScope(user, table.branchId);
    return table;
  }

  private async assertHall(id: string, user: AuthenticatedUser): Promise<void> {
    const hall = await this.prisma.hall.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });

    if (!hall) {
      throw new NotFoundException("Hall not found");
    }

    resolveBranchScope(user, hall.branchId);
  }

  private async assertBranch(id: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
  }

  private async assertEmployeeInBranch(
    tx: Prisma.TransactionClient,
    employeeId: string,
    branchId: string,
  ): Promise<void> {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, branchId, status: "ACTIVE" },
    });

    if (!employee) {
      throw new ForbiddenException("Employee is not active in this branch");
    }
  }

  private createCode(value: string): string {
    return `${value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")}_${Date.now().toString(36).toUpperCase()}`;
  }

  private createOrderNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll("-", "");
    const time = now.toISOString().slice(11, 19).replaceAll(":", "");

    return `WTR-${date}-${time}-${randomInt(1000, 10000)}`;
  }
}
