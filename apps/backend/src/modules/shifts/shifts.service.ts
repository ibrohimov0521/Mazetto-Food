import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CashTransactionType,
  CashTransferStatus,
  PaymentStatus,
  Prisma,
  ShiftStatus,
  ShiftType,
} from "@prisma/client";
import {
  resolveBranchScope,
  resolveRequiredBranchScope,
} from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { ListShiftsDto } from "./dto/list-shifts.dto";
import type {
  CloseShiftDto,
  CreateCashTransactionDto,
  CreateCashTransferDto,
  OpenShiftDto,
} from "./dto/shift.dto";

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
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertEmployeeInBranch(tx, employeeId, branchId);
      await this.assertDeviceInBranch(tx, dto.deviceId, branchId);

      /*
       * Smena raqami `MAX(shiftNumber) + 1` bilan olinadi — bu o'qib-yozish
       * poygasi (PHASE 6 H5). Prisma standart izolyatsiyasi Read Committed,
       * ya'ni bir filialda ikki kassir bir vaqtda smena ochsa ikkalasi bir xil
       * raqamni o'qiydi va `@@unique([branchId, shiftNumber])` biriga 500
       * qaytaradi.
       *
       * Filialga bog'langan maslahat qulfi ketma-ketlashtiradi: qulf tranzaksiya
       * oxirigacha ushlab turiladi va u tugagach avtomatik bo'shaydi. Naqsh
       * `orders/order-display-number.ts` dan olingan.
       *
       * Qulf ochiq smena tekshiruvidan OLDIN olinadi, aks holda ikki bir vaqtli
       * so'rov o'sha tekshiruvdan ham birga o'tib ketishi mumkin edi.
       */
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shift-open:${branchId}`}))`;

      const existingOpenShift = await tx.shift.findFirst({
        where: {
          branchId,
          employeeId,
          status: ShiftStatus.OPEN,
        },
      });

      if (existingOpenShift) {
        throw new BadRequestException(
          "Employee already has an open shift in this branch",
        );
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
          // Cash is owned by one employee shift. type is retained only
          // for legacy rows and must not create a second cash drawer.
          type: ShiftType.CASHIER,
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
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRawUnsafe(
              'SELECT "id" FROM "shifts" WHERE "id" = $1 FOR UPDATE',
              id,
            );
            const shift = await tx.shift.findUnique({ where: { id } });

            if (!shift) {
              throw new NotFoundException("Shift not found");
            }

            if (shift.status !== ShiftStatus.OPEN) {
              throw new BadRequestException("Shift is already closed");
            }

            await this.assertEmployeeInBranch(tx, employeeId, shift.branchId);
            this.assertCanOperateShift(user, shift.employeeId);

            const pendingTransfer = await tx.cashTransfer.findFirst({
              where: { fromShiftId: id, status: CashTransferStatus.PENDING },
              select: { id: true },
            });
            if (pendingTransfer) {
              throw new BadRequestException(
                "Pul topshirish hali tasdiqlanmagan. Avval kassir qabul qilishi yoki rad etishi kerak.",
              );
            }

            const payments = await tx.payment.findMany({
              where: {
                status: { in: [PaymentStatus.PAID, PaymentStatus.SUCCESS] },
                revenueRecords: { some: { shiftId: id } },
              },
              include: { method: true },
            });
            const cashTransactions = await tx.cashTransaction.findMany({
              where: { shiftId: id },
            });
            const orderIds = new Set(
              payments.map((payment) => payment.orderId),
            );
            const totals = this.calculateShiftTotals(
              payments,
              cashTransactions,
              orderIds.size,
            );
            const closingBalance = new Prisma.Decimal(dto.closingBalance);
            const expectedCash = this.calculateExpectedCash(
              shift.openingBalance,
              totals,
              cashTransactions,
            );
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
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15000,
          },
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
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id: shiftId } });

      if (!shift) {
        throw new NotFoundException("Shift not found");
      }

      if (shift.status !== ShiftStatus.OPEN) {
        throw new BadRequestException(
          "Cash transactions require an open shift",
        );
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

  async openCourierShift(dto: OpenShiftDto, user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    return this.openShift(
      { ...dto, employeeId: user.employeeId, type: ShiftType.CASHIER },
      user,
    );
  }

  async getCurrentCourierShift(user: AuthenticatedUser) {
    const employeeId = user.employeeId;
    if (!employeeId) {
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    const shift = await this.prisma.shift.findFirst({
      where: { employeeId, status: ShiftStatus.OPEN },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        cashTransactions: { orderBy: { occurredAt: "desc" } },
        outgoingCashTransfers: {
          where: { status: CashTransferStatus.PENDING },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { openedAt: "desc" },
    });

    if (!shift) {
      return null;
    }

    return {
      ...shift,
      currentCash: this.calculateCashBalance(
        shift.openingBalance,
        shift.cashTransactions,
      ),
      cashTransactions: shift.cashTransactions.slice(0, 200),
    };
  }

  async createCashTransfer(
    dto: CreateCashTransferDto,
    user: AuthenticatedUser,
  ) {
    const employeeId = user.employeeId;
    if (!employeeId) {
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findFirst({
        where: {
          employeeId,
          status: ShiftStatus.OPEN,
        },
        orderBy: { openedAt: "desc" },
      });
      if (!shift) {
        throw new BadRequestException("Open employee shift is required");
      }

      await this.assertEmployeeInBranch(tx, employeeId, shift.branchId);
      resolveBranchScope(user, shift.branchId);

      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "shifts" WHERE "id" = $1 FOR UPDATE',
        shift.id,
      );
      const current = await tx.shift.findUnique({ where: { id: shift.id } });
      if (current?.status !== ShiftStatus.OPEN) {
        throw new BadRequestException(
          "Smena yopilgan. Pul topshirib bo'lmaydi.",
        );
      }

      const transactions = await tx.cashTransaction.findMany({
        where: { shiftId: shift.id },
        select: { amount: true, type: true },
      });
      const balance = this.calculateCashBalance(
        shift.openingBalance,
        transactions,
      );
      const amount = new Prisma.Decimal(dto.amount);
      if (balance.lessThan(amount)) {
        throw new BadRequestException(
          "Topshirish summasi kassadagi naqd puldan oshmasligi kerak",
        );
      }

      const transfer = await tx.cashTransfer.create({
        data: {
          branchId: shift.branchId,
          fromShiftId: shift.id,
          amount,
          reason: dto.reason ?? "Xodim naqd pulni kassirga topshirdi",
          createdById: user.id,
        },
      });

      await tx.cashTransaction.create({
        data: {
          branchId: shift.branchId,
          shiftId: shift.id,
          employeeId,
          cashTransferId: transfer.id,
          type: CashTransactionType.CASH_OUT,
          amount,
          reason: "Cash transfer to cashier",
          createdById: user.id,
        },
      });

      return tx.cashTransfer.findUniqueOrThrow({
        where: { id: transfer.id },
        include: {
          fromShift: { include: { employee: true } },
          toShift: { include: { employee: true } },
        },
      });
    });
  }

  async listPendingCashTransfers(user: AuthenticatedUser) {
    this.assertCashReceiver(user);
    const employeeId = user.employeeId;
    if (!employeeId) throw new ForbiddenException("Employee profile is required");
    const branchId = resolveBranchScope(user);
    return this.prisma.cashTransfer.findMany({
      where: {
        status: CashTransferStatus.PENDING,
        fromShift: { employeeId: { not: employeeId } },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        fromShift: { include: { employee: true } },
        toShift: { include: { employee: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  async acceptCashTransfer(id: string, user: AuthenticatedUser) {
    this.assertCashReceiver(user);
    const employeeId = user.employeeId;
    if (!employeeId) {
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const cashierShift = await tx.shift.findFirst({
        where: {
          employeeId,
          status: ShiftStatus.OPEN,
        },
        orderBy: { openedAt: "desc" },
      });
      if (!cashierShift) {
        throw new BadRequestException("Open employee shift is required");
      }

      await this.assertEmployeeInBranch(tx, employeeId, cashierShift.branchId);
      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "shifts" WHERE "id" = $1 FOR UPDATE',
        cashierShift.id,
      );
      const current = await tx.shift.findUnique({
        where: { id: cashierShift.id },
      });
      if (current?.status !== ShiftStatus.OPEN)
        throw new BadRequestException("Kassir smenasi yopilgan");
      const locked = await tx.$queryRawUnsafe<{ id: string }[]>(
        'SELECT "id" FROM "cash_transfers" WHERE "id" = $1 FOR UPDATE',
        id,
      );
      if (locked.length !== 1) {
        throw new NotFoundException("Cash transfer not found");
      }

      const transfer = await tx.cashTransfer.findUnique({
        where: { id },
        include: { fromShift: true },
      });
      if (!transfer) {
        throw new NotFoundException("Cash transfer not found");
      }
      if (transfer.status !== CashTransferStatus.PENDING) {
        throw new BadRequestException("Cash transfer is already processed");
      }
      if (transfer.branchId !== cashierShift.branchId) {
        throw new ForbiddenException("Cash transfer belongs to another branch");
      }
      if (transfer.fromShift.employeeId === employeeId) {
        throw new ForbiddenException(
          "O'zingiz topshirgan pulni o'zingiz qabul qila olmaysiz",
        );
      }

      await tx.cashTransaction.create({
        data: {
          branchId: cashierShift.branchId,
          shiftId: cashierShift.id,
          employeeId,
          cashTransferId: transfer.id,
          type: CashTransactionType.CASH_IN,
          amount: transfer.amount,
          reason: "Cash transfer accepted",
          createdById: user.id,
        },
      });

      return tx.cashTransfer.update({
        where: { id },
        data: {
          status: CashTransferStatus.ACCEPTED,
          toShiftId: cashierShift.id,
          acceptedById: user.id,
          acceptedAt: new Date(),
        },
        include: {
          fromShift: { include: { employee: true } },
          toShift: { include: { employee: true } },
        },
      });
    });
  }

  async rejectCashTransfer(
    id: string,
    reason: string | undefined,
    user: AuthenticatedUser,
  ) {
    this.assertCashReceiver(user);
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<{ id: string }[]>(
        'SELECT "id" FROM "cash_transfers" WHERE "id" = $1 FOR UPDATE',
        id,
      );
      if (locked.length !== 1) {
        throw new NotFoundException("Cash transfer not found");
      }

      const transfer = await tx.cashTransfer.findUnique({
        where: { id },
        include: { fromShift: true },
      });
      if (!transfer) {
        throw new NotFoundException("Cash transfer not found");
      }
      if (transfer.status !== CashTransferStatus.PENDING) {
        throw new BadRequestException("Cash transfer is already processed");
      }

      resolveBranchScope(user, transfer.branchId);
      if (transfer.fromShift.employeeId === user.employeeId) {
        throw new ForbiddenException(
          "O'zingizning topshirig'ingizni rad eta olmaysiz",
        );
      }
      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "shifts" WHERE "id" = $1 FOR UPDATE',
        transfer.fromShiftId,
      );
      const sourceShift = await tx.shift.findUniqueOrThrow({
        where: { id: transfer.fromShiftId },
      });
      if (sourceShift.status === ShiftStatus.OPEN) {
        await tx.cashTransaction.create({
          data: {
            branchId: transfer.branchId,
            shiftId: transfer.fromShiftId,
            employeeId: transfer.fromShift.employeeId,
            cashTransferId: transfer.id,
            type: CashTransactionType.CASH_IN,
            amount: transfer.amount,
            reason: reason ?? "Cash transfer rejected and returned",
            createdById: user.id,
          },
        });
      }

      return tx.cashTransfer.update({
        where: { id },
        data: {
          status:
            sourceShift.status === ShiftStatus.OPEN
              ? CashTransferStatus.REJECTED
              : CashTransferStatus.DISPUTED,
          reason: reason ?? transfer.reason,
          rejectedAt: new Date(),
        },
        include: {
          fromShift: { include: { employee: true } },
          toShift: { include: { employee: true } },
        },
      });
    });
  }

  private assertCashReceiver(user: AuthenticatedUser) {
    if (
      !user.employeeId ||
      !user.roles.some((role) =>
        ["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"].includes(role),
      )
    ) {
      throw new ForbiddenException(
        "Pulni faqat kassir yoki mas'ul menejer qabul qiladi",
      );
    }
  }

  private calculateCashBalance(
    openingBalance: Prisma.Decimal,
    transactions: { amount: Prisma.Decimal; type: CashTransactionType }[],
  ) {
    const hasOpeningTransaction = transactions.some(
      (transaction) => transaction.type === CashTransactionType.OPENING_BALANCE,
    );
    const startingBalance = hasOpeningTransaction
      ? new Prisma.Decimal(0)
      : openingBalance;

    return transactions.reduce((balance, transaction) => {
      const outgoingTypes: CashTransactionType[] = [
        CashTransactionType.EXPENSE,
        CashTransactionType.REFUND,
        CashTransactionType.WITHDRAW,
        CashTransactionType.CASH_OUT,
      ];
      const outgoing = outgoingTypes.includes(transaction.type);
      return outgoing
        ? balance.sub(transaction.amount)
        : balance.add(transaction.amount);
    }, startingBalance);
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
    const terminalTotal = this.sumPaymentsByCodes(payments, [
      "CARD",
      "TERMINAL",
    ]);
    const clickTotal = this.sumPaymentsByCodes(payments, ["CLICK"]);
    const paymeTotal = this.sumPaymentsByCodes(payments, ["PAYME"]);
    const knownCodes = new Set(["CASH", "CARD", "TERMINAL", "CLICK", "PAYME"]);
    const otherPaymentTotal = payments.reduce(
      (total, payment) =>
        knownCodes.has(payment.method.code) ? total : total.add(payment.amount),
      new Prisma.Decimal(0),
    );
    const expensesTotal = this.sumCashTransactions(cashTransactions, [
      CashTransactionType.EXPENSE,
    ]);
    const incomeTotal = this.sumCashTransactions(cashTransactions, [
      CashTransactionType.INCOME,
      CashTransactionType.CASH_IN,
    ]);
    const refundsTotal = this.sumCashTransactions(cashTransactions, [
      CashTransactionType.REFUND,
    ]);

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
      (total, payment) =>
        codes.includes(payment.method.code) ? total.add(payment.amount) : total,
      new Prisma.Decimal(0),
    );
  }

  private sumCashTransactions(
    cashTransactions: { amount: Prisma.Decimal; type: CashTransactionType }[],
    types: CashTransactionType[],
  ) {
    return cashTransactions.reduce(
      (total, transaction) =>
        types.includes(transaction.type)
          ? total.add(transaction.amount)
          : total,
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

    const device = await tx.device.findFirst({
      where: { id: deviceId, branchId, isActive: true },
    });

    if (!device) {
      throw new NotFoundException("Device not found");
    }
  }

  private resolveTargetEmployee(
    employeeId: string | undefined,
    user: AuthenticatedUser,
  ): string | undefined {
    if (!employeeId || employeeId === user.employeeId) {
      return user.employeeId;
    }

    if (this.canManageBranchShift(user)) {
      return employeeId;
    }

    throw new ForbiddenException("Cannot operate another employee shift");
  }

  private assertCanOperateShift(
    user: AuthenticatedUser,
    shiftEmployeeId: string,
  ): void {
    if (
      shiftEmployeeId === user.employeeId ||
      this.canManageBranchShift(user)
    ) {
      return;
    }

    throw new ForbiddenException("Cannot operate another employee shift");
  }

  private canManageBranchShift(user: AuthenticatedUser): boolean {
    return user.roles.some((role) =>
      ["SUPER_ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"].includes(role),
    );
  }

  private isRetryableTransactionConflict(error: unknown): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return true;
    }

    if (
      error instanceof Prisma.PrismaClientUnknownRequestError &&
      /write conflict|deadlock|could not serialize access/i.test(error.message)
    ) {
      return true;
    }

    if (
      error instanceof Error &&
      /write conflict|deadlock|could not serialize access/i.test(error.message)
    ) {
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
