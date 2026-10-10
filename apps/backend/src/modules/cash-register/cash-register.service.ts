import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CashTransactionType,
  OrderStatus,
  Prisma,
  ShiftStatus,
} from "@prisma/client";
import { resolveBranchScope } from "../../common/auth/access-scope";
import { hasPermission } from "../../common/auth/authorization";
import { PERMISSIONS } from "../../common/auth/permissions";
import { resolveRestaurantTenantId } from "../../common/auth/tenant-scope";
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
    const tenantId = await resolveRestaurantTenantId(this.prisma, user);
    const shift = await this.prisma.shift.findFirst({
      where: {
        employeeId,
        status: ShiftStatus.OPEN,
        branch: { tenantId },
      },
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

  openCourierShift(
    dto: OpenShiftDto,
    user: AuthenticatedUser,
    context?: { idempotencyKey?: string; correlationId?: string },
  ) {
    return this.shiftsService.openCourierShift(dto, user, context);
  }

  createCashTransfer(
    dto: CreateCashTransferDto,
    user: AuthenticatedUser,
    context?: { idempotencyKey?: string; correlationId?: string },
  ) {
    return this.shiftsService.createCashTransfer(dto, user, context);
  }

  listTransferReceivers(user: AuthenticatedUser) {
    return this.shiftsService.listCashTransferReceivers(user);
  }

  listPendingTransfers(user: AuthenticatedUser) {
    return this.shiftsService.listPendingCashTransfers(user);
  }

  getTransferDetail(id: string, user: AuthenticatedUser) {
    return this.shiftsService.getCashTransferDetail(id, user);
  }

  acceptTransfer(
    id: string,
    user: AuthenticatedUser,
    context?: { idempotencyKey?: string; correlationId?: string },
  ) {
    return this.shiftsService.acceptCashTransfer(id, user, context);
  }

  rejectTransfer(
    id: string,
    reason: string | undefined,
    user: AuthenticatedUser,
    context?: { idempotencyKey?: string; correlationId?: string },
  ) {
    return this.shiftsService.rejectCashTransfer(id, reason, user, context);
  }

  openShift(
    dto: OpenShiftDto,
    user: AuthenticatedUser,
    context?: { idempotencyKey?: string; correlationId?: string },
  ) {
    return this.shiftsService.openShift(dto, user, context);
  }

  closeShift(
    id: string,
    dto: CloseShiftDto,
    user: AuthenticatedUser,
    context?: { idempotencyKey?: string; correlationId?: string },
  ) {
    return this.shiftsService.closeShift(id, dto, user, context);
  }

  createCashTransaction(
    id: string,
    dto: CreateCashTransactionDto,
    user: AuthenticatedUser,
    context?: { idempotencyKey?: string; correlationId?: string },
  ) {
    return this.shiftsService.createCashTransaction(id, dto, user, context);
  }

  async getTransactions(
    shiftId: string,
    query: { limit?: string; offset?: string },
    user: AuthenticatedUser,
  ) {
    const tenantId = await resolveRestaurantTenantId(this.prisma, user);
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, branch: { tenantId } },
      select: { branchId: true, employeeId: true },
    });

    if (!shift) {
      return { items: [], total: 0 };
    }

    resolveBranchScope(user, shift.branchId);
    this.assertCanViewShift(user, shift.employeeId);

    const where = { shiftId };
    const pageQuery: Prisma.CashTransactionFindManyArgs = {
      where,
      include: {
        employee: true,
        payment: { include: { method: true } },
        order: true,
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    };

    // Older POS clients request this endpoint without page parameters and
    // expect the original array response.
    const paginationRequested =
      query.limit !== undefined || query.offset !== undefined;
    if (!paginationRequested) {
      return this.prisma.cashTransaction.findMany({
        ...pageQuery,
        take: 200,
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.cashTransaction.findMany({
        ...pageQuery,
        skip: this.parseOffset(query.offset),
        take: this.parseLimit(query.limit),
      }),
      this.prisma.cashTransaction.count({ where }),
    ]);

    return { items, total };
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
    const tenantId = await resolveRestaurantTenantId(this.prisma, user);
    const shift = await this.prisma.shift.findFirst({
      where: {
        employeeId,
        status: ShiftStatus.OPEN,
        branch: { tenantId },
      },
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
        branch: { tenantId },
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
        payments: {
          include: {
            method: true,
            refunds: {
              select: { id: true, orderItemId: true, amount: true, reason: true, createdAt: true },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: this.parseOffset(query.offset),
      take: this.parseLimit(query.limit),
    });
  }

  async listOwnShifts(
    query: { limit?: string; offset?: string },
    user: AuthenticatedUser,
  ) {
    const employeeId = this.requireEmployee(user);
    const tenantId = await resolveRestaurantTenantId(this.prisma, user);

    const shifts = await this.prisma.shift.findMany({
      where: { employeeId, branch: { tenantId } },
      select: {
        id: true,
        shiftNumber: true,
        status: true,
        openedAt: true,
        closedAt: true,
        openingBalance: true,
        closingBalance: true,
        expectedCash: true,
        cashDifference: true,
        salesTotal: true,
        cashTotal: true,
        _count: { select: { orders: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { openedAt: "desc" },
      skip: this.parseOffset(query.offset),
      take: this.parseLimit(query.limit),
    });
    return shifts.map(({ _count, ...shift }) => ({ ...shift, orderCount: _count.orders }));
  }

  async getShiftHistoryDetail(shiftId: string, user: AuthenticatedUser) {
    const tenantId = await resolveRestaurantTenantId(this.prisma, user);
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, branch: { tenantId } },
      select: {
        id: true,
        employeeId: true,
        branchId: true,
        shiftNumber: true,
        status: true,
        openedAt: true,
        closedAt: true,
        openingBalance: true,
        closingBalance: true,
        expectedCash: true,
        cashDifference: true,
        salesTotal: true,
        cashTotal: true,
        _count: { select: { orders: true } },
        branch: { select: { id: true, name: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
    });
    if (!shift) throw new NotFoundException("Shift not found");

    resolveBranchScope(user, shift.branchId);
    if (
      shift.employeeId !== user.employeeId &&
      !hasPermission(user, PERMISSIONS.SHIFT_VIEW_BRANCH)
    ) {
      throw new ForbiddenException("Cannot access another employee shift");
    }

    const { _count, ...history } = shift;
    return { ...history, orderCount: _count.orders };
  }

  async getShiftOrders(
    shiftId: string,
    query: {
      status?: string;
      search?: string;
      sort?: string;
      limit?: string;
      offset?: string;
    },
    user: AuthenticatedUser,
  ) {
    const tenantId = await resolveRestaurantTenantId(this.prisma, user);
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, branch: { tenantId } },
      select: { id: true, branchId: true, employeeId: true },
    });
    if (!shift) return [];

    resolveBranchScope(user, shift.branchId);
    if (
      shift.employeeId !== user.employeeId &&
      !hasPermission(user, PERMISSIONS.SHIFT_VIEW_BRANCH)
    ) {
      throw new ForbiddenException("Cannot access another employee shift");
    }

    const status = this.toOrderStatus(query.status);
    const search = query.search?.trim();
    return this.prisma.order.findMany({
      where: {
        AND: [{
          OR: [
            { shiftId: shift.id },
            { revenueRecords: { some: { shiftId: shift.id } } },
          ],
        }],
        branchId: shift.branchId,
        branch: { tenantId },
        ...(status ? { status } : {}),
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
              select: { firstName: true, lastName: true, employeeCode: true },
            },
            changedByUser: { select: { displayName: true, email: true } },
          },
        },
        items: { orderBy: { createdAt: "asc" } },
        payments: {
          include: {
            method: true,
            refunds: {
              select: { id: true, orderItemId: true, amount: true, reason: true, createdAt: true },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        receipts: {
          where: { documentType: "RECEIPT" },
          select: { id: true, receiptNumber: true, printed: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: query.sort === "amount-high"
        ? [{ total: "desc" }, { id: "desc" }]
        : query.sort === "amount-low"
          ? [{ total: "asc" }, { id: "asc" }]
          : query.sort === "oldest"
            ? [{ createdAt: "asc" }, { id: "asc" }]
            : [{ createdAt: "desc" }, { id: "desc" }],
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
    const hasOpeningTransaction = shift.cashTransactions.some(
      (transaction) =>
        transaction.type === CashTransactionType.OPENING_BALANCE,
    );
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
      hasOpeningTransaction ? new Prisma.Decimal(0) : shift.openingBalance,
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
