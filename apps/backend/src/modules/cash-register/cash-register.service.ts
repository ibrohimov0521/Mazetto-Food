import { ForbiddenException, Injectable } from "@nestjs/common";
import { CashTransactionType, Prisma, ShiftStatus } from "@prisma/client";
import { resolveBranchScope } from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { CloseShiftDto, CreateCashTransactionDto, OpenShiftDto } from "../shifts/dto/shift.dto";
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
        cashTransactions: { orderBy: { occurredAt: "desc" }, take: 50 },
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
    };
  }

  openShift(dto: OpenShiftDto, user: AuthenticatedUser) {
    return this.shiftsService.openShift(dto, user);
  }

  closeShift(id: string, dto: CloseShiftDto, user: AuthenticatedUser) {
    return this.shiftsService.closeShift(id, dto, user);
  }

  createCashTransaction(id: string, dto: CreateCashTransactionDto, user: AuthenticatedUser) {
    return this.shiftsService.createCashTransaction(id, dto, user);
  }

  async getTransactions(shiftId: string, user: AuthenticatedUser) {
    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId }, select: { branchId: true } });

    if (!shift) {
      return [];
    }

    resolveBranchScope(user, shift.branchId);

    return this.prisma.cashTransaction.findMany({
      where: { shiftId },
      include: { employee: true, payment: { include: { method: true } }, order: true },
      orderBy: { occurredAt: "desc" },
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
    const currentBalance = shift.cashTransactions.reduce((total, transaction) => {
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
    }, new Prisma.Decimal(0));

    const paidRevenue = shift.revenueRecords.filter((record) => record.payment);
    const orderIds = new Set(paidRevenue.map((record) => record.orderId).filter(Boolean));
    const cashSales = paidRevenue.reduce((total, record) => {
      return record.payment?.method.code === "CASH" ? total.add(record.amount) : total;
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
      throw new ForbiddenException("Authenticated user is not linked to an employee");
    }

    return user.employeeId;
  }
}
