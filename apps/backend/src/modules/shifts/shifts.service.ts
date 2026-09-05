import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CashTransactionType, PaymentStatus, Prisma, ShiftStatus } from "@prisma/client";
import { resolveBranchScope, resolveRequiredBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { ListShiftsDto } from "./dto/list-shifts.dto";
import type { CloseShiftDto, CreateCashTransactionDto, OpenShiftDto } from "./dto/shift.dto";

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Filial smenalari ro'yxati.
   *
   * `SHIFT_VIEW_BRANCH` permission'i bilan himoyalangan — `SHIFT_VIEW_OWN`
   * dan farqli, bu butun filial smenalarini ko'rsatadi. Branch scope
   * `resolveBranchScope` orqali majburlanadi: branch-scoped rol boshqa
   * filialni so'rasa `ForbiddenException` qaytadi.
   */
  async listShifts(query: ListShiftsDto, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user, query.branchId);
    const openedAt =
      query.from || query.to
        ? {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          }
        : undefined;

    return this.prisma.shift.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(openedAt ? { openedAt } : {}),
      },
      orderBy: { openedAt: "desc" },
      skip: query.offset,
      take: query.limit,
      include: this.shiftInclude(),
    });
  }

  async openShift(dto: OpenShiftDto, user: AuthenticatedUser) {
    const employeeId = this.resolveTargetEmployee(dto.employeeId, user);
    const branchId = resolveRequiredBranchScope(user, dto.branchId);

    if (!employeeId) {
      throw new ForbiddenException("Authenticated user is not linked to an employee");
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertEmployeeInBranch(tx, employeeId, branchId);
      await this.assertDeviceInBranch(tx, dto.deviceId, branchId);

      const existingOpenShift = await tx.shift.findFirst({
        where: {
          branchId,
          employeeId,
          status: ShiftStatus.OPEN,
        },
      });

      if (existingOpenShift) {
        throw new BadRequestException("Employee already has an open shift in this branch");
      }

      const latestShift = await tx.shift.findFirst({
        where: { branchId },
        orderBy: { shiftNumber: "desc" },
        select: { shiftNumber: true },
      });
      const shift = await tx.shift.create({
        data: {
          branchId,
          employeeId,
          deviceId: dto.deviceId ?? null,
          shiftNumber: (latestShift?.shiftNumber ?? 0) + 1,
          openingBalance: new Prisma.Decimal(dto.openingBalance),
        },
        include: this.shiftInclude(),
      });

      await tx.cashTransaction.create({
        data: {
          branchId,
          shiftId: shift.id,
          employeeId,
          type: CashTransactionType.OPENING_BALANCE,
          amount: shift.openingBalance,
          reason: "Shift opened",
          createdById: user.id,
        },
      });

      return shift;
    });
  }

  async closeShift(id: string, dto: CloseShiftDto, user: AuthenticatedUser) {
    const employeeId = user.employeeId;

    if (!employeeId) {
      throw new ForbiddenException("Authenticated user is not linked to an employee");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
        const shift = await tx.shift.findUnique({ where: { id } });

        if (!shift) {
          throw new NotFoundException("Shift not found");
        }

        if (shift.status !== ShiftStatus.OPEN) {
          throw new BadRequestException("Shift is already closed");
        }

        await this.assertEmployeeInBranch(tx, employeeId, shift.branchId);
        this.assertCanOperateShift(user, shift.employeeId);

        const payments = await tx.payment.findMany({
          where: {
            status: { in: [PaymentStatus.PAID, PaymentStatus.SUCCESS] },
            revenueRecords: { some: { shiftId: id } },
          },
          include: { method: true },
        });
        const cashTransactions = await tx.cashTransaction.findMany({ where: { shiftId: id } });
        const orderIds = new Set(payments.map((payment) => payment.orderId));
        const totals = this.calculateShiftTotals(payments, cashTransactions, orderIds.size);
        const closingBalance = new Prisma.Decimal(dto.closingBalance);
        const expectedCash = this.calculateExpectedCash(shift.openingBalance, totals, cashTransactions);
        const cashDifference = closingBalance.sub(expectedCash);

        const closed = await tx.shift.updateMany({
          where: { id, status: ShiftStatus.OPEN },
          data: {
            status: ShiftStatus.CLOSED,
            closedAt: new Date(),
            closingBalance,
            expectedCash,
            cashDifference,
            ...totals,
          },
        });

        if (closed.count !== 1) {
          throw new BadRequestException("Shift is already closed");
        }

        await tx.cashTransaction.create({
          data: {
            branchId: shift.branchId,
            shiftId: id,
            employeeId,
            type: CashTransactionType.CLOSING_BALANCE,
            amount: closingBalance,
            reason: "Shift closed",
            createdById: user.id,
          },
        });

        return tx.shift.findUniqueOrThrow({
          where: { id },
          include: this.shiftInclude(),
        });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
        );
      } catch (error) {
        if (this.isRetryableTransactionConflict(error) && attempt < 2) {
          continue;
        }

        throw error;
      }
    }

    throw new BadRequestException("Shift could not be closed");
  }

  async createCashTransaction(
    shiftId: string,
    dto: CreateCashTransactionDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = user.employeeId;

    if (!employeeId) {
      throw new ForbiddenException("Authenticated user is not linked to an employee");
    }

    return this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id: shiftId } });

      if (!shift) {
        throw new NotFoundException("Shift not found");
      }

      if (shift.status !== ShiftStatus.OPEN) {
        throw new BadRequestException("Cash transactions require an open shift");
      }

      await this.assertEmployeeInBranch(tx, employeeId, shift.branchId);
      this.assertCanOperateShift(user, shift.employeeId);

      return tx.cashTransaction.create({
        data: {
          branchId: shift.branchId,
          shiftId,
          employeeId,
          orderId: dto.orderId ?? null,
          paymentId: dto.paymentId ?? null,
          type: dto.type,
          amount: new Prisma.Decimal(dto.amount),
          reason: dto.reason ?? null,
          createdById: user.id,
        },
      });
    });
  }

  private calculateShiftTotals(
    payments: { amount: Prisma.Decimal; method: { code: string } }[],
    cashTransactions: { amount: Prisma.Decimal; type: CashTransactionType }[],
    orderCount: number,
  ) {
    const salesTotal = payments.reduce(
      (total, payment) => total.add(payment.amount),
      new Prisma.Decimal(0),
    );
    const cashTotal = this.sumPaymentsByCodes(payments, ["CASH"]);
    const terminalTotal = this.sumPaymentsByCodes(payments, ["CARD", "TERMINAL"]);
    const clickTotal = this.sumPaymentsByCodes(payments, ["CLICK"]);
    const paymeTotal = this.sumPaymentsByCodes(payments, ["PAYME"]);
    const knownCodes = new Set(["CASH", "CARD", "TERMINAL", "CLICK", "PAYME"]);
    const otherPaymentTotal = payments.reduce(
      (total, payment) =>
        knownCodes.has(payment.method.code) ? total : total.add(payment.amount),
      new Prisma.Decimal(0),
    );
    const expensesTotal = this.sumCashTransactions(cashTransactions, [CashTransactionType.EXPENSE]);
    const incomeTotal = this.sumCashTransactions(cashTransactions, [
      CashTransactionType.INCOME,
      CashTransactionType.CASH_IN,
    ]);
    const refundsTotal = this.sumCashTransactions(cashTransactions, [CashTransactionType.REFUND]);

    return {
      salesTotal,
      cashTotal,
      terminalTotal,
      clickTotal,
      paymeTotal,
      otherPaymentTotal,
      expensesTotal,
      incomeTotal,
      refundsTotal,
      orderCount,
    };
  }

  private calculateExpectedCash(
    openingBalance: Prisma.Decimal,
    totals: {
      cashTotal: Prisma.Decimal;
      expensesTotal: Prisma.Decimal;
      incomeTotal: Prisma.Decimal;
      refundsTotal: Prisma.Decimal;
    },
    cashTransactions: { amount: Prisma.Decimal; type: CashTransactionType }[],
  ) {
    const withdrawalsTotal = this.sumCashTransactions(cashTransactions, [
      CashTransactionType.WITHDRAW,
      CashTransactionType.CASH_OUT,
    ]);

    return openingBalance
      .add(totals.cashTotal)
      .add(totals.incomeTotal)
      .sub(totals.expensesTotal)
      .sub(totals.refundsTotal)
      .sub(withdrawalsTotal);
  }

  private sumPaymentsByCodes(
    payments: { amount: Prisma.Decimal; method: { code: string } }[],
    codes: string[],
  ) {
    return payments.reduce(
      (total, payment) => (codes.includes(payment.method.code) ? total.add(payment.amount) : total),
      new Prisma.Decimal(0),
    );
  }

  private sumCashTransactions(
    cashTransactions: { amount: Prisma.Decimal; type: CashTransactionType }[],
    types: CashTransactionType[],
  ) {
    return cashTransactions.reduce(
      (total, transaction) =>
        types.includes(transaction.type) ? total.add(transaction.amount) : total,
      new Prisma.Decimal(0),
    );
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

  private async assertDeviceInBranch(
    tx: Prisma.TransactionClient,
    deviceId: string | undefined,
    branchId: string,
  ): Promise<void> {
    if (!deviceId) {
      return;
    }

    const device = await tx.device.findFirst({ where: { id: deviceId, branchId, isActive: true } });

    if (!device) {
      throw new NotFoundException("Device not found");
    }
  }

  private resolveTargetEmployee(employeeId: string | undefined, user: AuthenticatedUser): string | undefined {
    if (!employeeId || employeeId === user.employeeId) {
      return user.employeeId;
    }

    if (this.canManageBranchShift(user)) {
      return employeeId;
    }

    throw new ForbiddenException("Cannot operate another cashier shift");
  }

  private assertCanOperateShift(user: AuthenticatedUser, shiftEmployeeId: string): void {
    if (shiftEmployeeId === user.employeeId || this.canManageBranchShift(user)) {
      return;
    }

    throw new ForbiddenException("Cannot operate another cashier shift");
  }

  private canManageBranchShift(user: AuthenticatedUser): boolean {
    return user.roles.some((role) => ["SUPER_ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"].includes(role));
  }

  private isRetryableTransactionConflict(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return true;
    }

    if (
      error instanceof Prisma.PrismaClientUnknownRequestError &&
      /write conflict|deadlock|could not serialize access/i.test(error.message)
    ) {
      return true;
    }

    if (error instanceof Error && /write conflict|deadlock|could not serialize access/i.test(error.message)) {
      return true;
    }

    return false;
  }

  private shiftInclude() {
    return {
      branch: { select: { id: true, code: true, name: true } },
      employee: { select: { id: true, firstName: true, lastName: true } },
      device: { select: { id: true, name: true, type: true } },
    } satisfies Prisma.ShiftInclude;
  }
}
