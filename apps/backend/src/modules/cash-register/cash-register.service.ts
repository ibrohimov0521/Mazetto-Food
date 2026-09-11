import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  CashTransactionType,
  OrderStatus,
  Prisma,
  ShiftStatus,
} from "@prisma/client";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CloseShiftDto,
  CreateCashTransactionDto,
  CreateCashTransferDto,
  OpenShiftDto,
} from "../shifts/dto/shift.dto";
import { ShiftsService } from "../shifts/shifts.service";

@Injectable()
export class CashRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftsService: ShiftsService,
  ) {}

  async getCurrentShift(user: AuthenticatedUser) {
    const employeeId = this.requireEmployee(user);
    const shift = await this.prisma.shift.findFirst({
      where: { employeeId, status: ShiftStatus.OPEN },
      include: {
        branch: true,
        employee: true,
        cashTransactions: { orderBy: { occurredAt: "desc" } },
        outgoingCashTransfers: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            toShift: {
              select: {
                employee: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        revenueRecords: { include: { payment: { include: { method: true } } } },
      },
      orderBy: { openedAt: "desc" },
    });

    if (!shift) {
      return null;
    }

    return {
      ...shift,
      ...this.calculateShiftSummary(shift),
      cashTransactions: shift.cashTransactions.slice(0, 50),
    };
  }

  getCourierShift(user: AuthenticatedUser) {
    return this.shiftsService.getCurrentCourierShift(user);
  }

  openCourierShift(dto: OpenShiftDto, user: AuthenticatedUser) {
    return this.shiftsService.openCourierShift(dto, user);
  }

  createCashTransfer(dto: CreateCashTransferDto, user: AuthenticatedUser) {
    return this.shiftsService.createCashTransfer(dto, user);
  }

  listPendingTransfers(user: AuthenticatedUser) {
    return this.shiftsService.listPendingCashTransfers(user);
  }

  acceptTransfer(id: string, user: AuthenticatedUser) {
    return this.shiftsService.acceptCashTransfer(id, user);
  }

  rejectTransfer(
    id: string,
    reason: string | undefined,
    user: AuthenticatedUser,
  ) {
    return this.shiftsService.rejectCashTransfer(id, reason, user);
  }

  openShift(dto: OpenShiftDto, user: AuthenticatedUser) {
    return this.shiftsService.openShift(dto, user);
  }

  closeShift(id: string, dto: CloseShiftDto, user: AuthenticatedUser) {
    return this.shiftsService.closeShift(id, dto, user);
  }

  createCashTransaction(
    id: string,
    dto: CreateCashTransactionDto,
    user: AuthenticatedUser,
  ) {
    return this.shiftsService.createCashTransaction(id, dto, user);
  }

  async getTransactions(shiftId: string, user: AuthenticatedUser) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      select: { branchId: true, employeeId: true },
    });

    if (!shift) {
      return [];
    }

    resolveBranchScope(user, shift.branchId);
    this.assertCanViewShift(user, shift.employeeId);

    return this.prisma.cashTransaction.findMany({
      where: { shiftId },
      include: {
        employee: true,
        payment: { include: { method: true } },
        order: true,
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
  }

  async getCurrentShiftOrders(
    query: {
      status?: string;
      search?: string;
      limit?: string;
      offset?: string;
    },
    user: AuthenticatedUser,
  ) {
    const employeeId = this.requireEmployee(user);
    const shift = await this.prisma.shift.findFirst({
      where: { employeeId, status: ShiftStatus.OPEN },
      orderBy: { openedAt: "desc" },
      select: { id: true, branchId: true, employeeId: true },
    });

    if (!shift) {
      return [];
    }

    resolveBranchScope(user, shift.branchId);
    this.assertCanViewShift(user, shift.employeeId);

    const status = this.toOrderStatus(query.status);
    const search = query.search?.trim();
    const day = this.todayTashkentRange();

    return this.prisma.order.findMany({
      where: {
        shiftId: shift.id,
        createdAt: { gte: day.start, lt: day.end },
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { orderNumber: { contains: search, mode: "insensitive" } },
                {
                  displayOrderNumber: { contains: search, mode: "insensitive" },
                },
                { customerName: { contains: search, mode: "insensitive" } },
                { customerPhone: { contains: search, mode: "insensitive" } },
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
        items: { orderBy: { createdAt: "asc" } },
        payments: { include: { method: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      skip: this.parseOffset(query.offset),
      take: this.parseLimit(query.limit),
    });
  }

  private calculateShiftSummary(shift: {
    openingBalance: Prisma.Decimal;
    cashTransactions: { amount: Prisma.Decimal; type: CashTransactionType }[];
    revenueRecords: {
      orderId: string | null;
      amount: Prisma.Decimal;
      payment: { method: { code: string } } | null;
    }[];
  }) {
    const currentBalance = shift.cashTransactions.reduce(
      (total, transaction) => {
        const amount = transaction.amount;

        if (
          transaction.type === CashTransactionType.REFUND ||
          transaction.type === CashTransactionType.EXPENSE ||
          transaction.type === CashTransactionType.WITHDRAW ||
          transaction.type === CashTransactionType.CASH_OUT
        ) {
          return total.sub(amount);
        }

        if (
          transaction.type === CashTransactionType.CLOSING ||
          transaction.type === CashTransactionType.CLOSING_BALANCE
        ) {
          return total;
        }

        return total.add(amount);
      },
      new Prisma.Decimal(0),
    );

    const paidRevenue = shift.revenueRecords.filter((record) => record.payment);
    const orderIds = new Set(
      paidRevenue.map((record) => record.orderId).filter(Boolean),
    );
    const cashSales = paidRevenue.reduce((total, record) => {
      return record.payment?.method.code === "CASH"
        ? total.add(record.amount)
        : total;
    }, new Prisma.Decimal(0));

    return {
      currentBalance,
      expectedCash: currentBalance,
      cashSales,
      orderCount: orderIds.size,
    };
  }

  private requireEmployee(user: AuthenticatedUser): string {
    if (!user.employeeId) {
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    return user.employeeId;
  }

  private assertCanViewShift(
    user: AuthenticatedUser,
    shiftEmployeeId: string,
  ): void {
    if (
      shiftEmployeeId === user.employeeId ||
      user.roles.some((role) =>
        ["SUPER_ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"].includes(role),
      )
    ) {
      return;
    }

    throw new ForbiddenException("Cannot access another employee shift");
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

  private toOrderStatus(status?: string): OrderStatus | undefined {
    return Object.values(OrderStatus).includes(status as OrderStatus)
      ? (status as OrderStatus)
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
}
