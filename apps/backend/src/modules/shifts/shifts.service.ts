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
import { writeAuditLog } from "../audit/audit-write";
import type { ListShiftsDto } from "./dto/list-shifts.dto";
import type {
  CloseShiftDto,
  CreateCashTransactionDto,
  CreateCashTransferDto,
  ForceCashHandoverDto,
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

    const shifts = await this.prisma.shift.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(openedAt ? { openedAt } : {}),
      },
      orderBy: { openedAt: "desc" },
      skip: query.offset,
      take: query.limit,
      include: {
        ...this.shiftInclude(),
        cashTransactions: { select: { amount: true, type: true } },
      },
    });

    return shifts.map((shift) => ({
      ...shift,
      currentCash:
        shift.status === ShiftStatus.OPEN
          ? this.calculateCashBalance(
              shift.openingBalance,
              shift.cashTransactions,
            )
          : null,
      cashTransactions: undefined,
    }));
  }

  async forceCashHandover(
    sourceShiftId: string,
    dto: ForceCashHandoverDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const sourceLock = await tx.$queryRawUnsafe<{ id: string }[]>(
          'SELECT "id" FROM "shifts" WHERE "id" = $1 FOR UPDATE',
          sourceShiftId,
        );
        if (sourceLock.length !== 1) {
          throw new NotFoundException("Source shift not found");
        }

        const source = await tx.shift.findUnique({
          where: { id: sourceShiftId },
        });
        if (!source) throw new NotFoundException("Source shift not found");
        if (source.status !== ShiftStatus.OPEN) {
          throw new BadRequestException(
            "Faqat ochiq smenadan pul topshiriladi",
          );
        }
        resolveBranchScope(user, source.branchId);
        if (sourceShiftId === dto.toShiftId) {
          throw new BadRequestException(
            "Manba va qabul qiluvchi smena bir xil bo'lmasligi kerak",
          );
        }

        const receiverLock = await tx.$queryRawUnsafe<{ id: string }[]>(
          'SELECT "id" FROM "shifts" WHERE "id" = $1 FOR UPDATE',
          dto.toShiftId,
        );
        if (receiverLock.length !== 1) {
          throw new NotFoundException("Qabul qiluvchi smena topilmadi");
        }
        const receiver = await tx.shift.findUnique({
          where: { id: dto.toShiftId },
          include: {
            employee: {
              select: {
                id: true,
                status: true,
                user: {
                  select: {
                    roles: { select: { role: { select: { code: true } } } },
                  },
                },
              },
            },
          },
        });
        if (!receiver || receiver.status !== ShiftStatus.OPEN) {
          throw new BadRequestException("Qabul qiluvchi smena ochiq emas");
        }
        if (receiver.branchId !== source.branchId) {
          throw new ForbiddenException(
            "Pulni faqat shu filialdagi smenaga topshirish mumkin",
          );
        }
        const receiverRoles =
          receiver.employee.user?.roles.map((item) => item.role.code) ?? [];
        if (
          receiver.employee.status !== "ACTIVE" ||
          !receiverRoles.some((role) =>
            ["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"].includes(role),
          )
        ) {
          throw new BadRequestException(
            "Tanlangan xodim pul qabul qiluvchi kassir emas",
          );
        }

        const transactions = await tx.cashTransaction.findMany({
          where: { shiftId: source.id },
          select: { amount: true, type: true },
        });
        const balance = this.calculateCashBalance(
          source.openingBalance,
          transactions,
        );
        const amount = new Prisma.Decimal(dto.amount ?? balance);
        if (amount.lessThanOrEqualTo(0) || amount.greaterThan(balance)) {
          throw new BadRequestException(
            "Topshirish summasi kassadagi joriy naqd qoldiqdan oshmasligi kerak",
          );
        }

        const transfer = await tx.cashTransfer.create({
          data: {
            branchId: source.branchId,
            fromShiftId: source.id,
            toShiftId: receiver.id,
            status: CashTransferStatus.ACCEPTED,
            amount,
            reason: dto.reason?.trim() || "Admin majburiy naqd topshiruvi",
            createdById: user.id,
            acceptedById: user.id,
            acceptedAt: new Date(),
          },
        });
        await this.createTransferAllocations(
          tx,
          transfer.id,
          source.id,
          amount,
        );
        await tx.cashTransaction.create({
          data: {
            branchId: source.branchId,
            shiftId: source.id,
            employeeId: source.employeeId,
            cashTransferId: transfer.id,
            type: CashTransactionType.CASH_OUT,
            amount,
            reason: "Admin majburiy topshiruvi — manba smenadan chiqarildi",
            createdById: user.id,
          },
        });
        await tx.cashTransaction.create({
          data: {
            branchId: source.branchId,
            shiftId: receiver.id,
            employeeId: receiver.employeeId,
            cashTransferId: transfer.id,
            type: CashTransactionType.CASH_IN,
            amount,
            reason: "Admin majburiy topshiruvi — kassaga qabul qilindi",
            createdById: user.id,
          },
        });

        await writeAuditLog(tx, {
          userId: user.id,
          action: "CASH_HANDOVER_FORCED",
          entity: "Shift",
          entityId: source.id,
          metadata: {
            branchId: source.branchId,
            transferId: transfer.id,
            fromShiftId: source.id,
            toShiftId: receiver.id,
            amount: amount.toString(),
            reason: transfer.reason,
          },
        });

        return tx.cashTransfer.findUniqueOrThrow({
          where: { id: transfer.id },
          include: {
            fromShift: { include: { employee: true } },
            toShift: { include: { employee: true } },
            allocations: this.transferAllocationInclude(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
                status: { in: [PaymentStatus.PAID, PaymentStatus.SUCCESS, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] },
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
        throw new BadRequestException("Xodim smenasi ochiq bo'lishi shart");
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

      if (!dto.toShiftId) {
        throw new BadRequestException(
          "Pulni qabul qiladigan ochiq kassir smenasini tanlang",
        );
      }

      const receiverShift = await tx.shift.findUnique({
        where: { id: dto.toShiftId },
        select: {
          id: true,
          branchId: true,
          employeeId: true,
          status: true,
          employee: {
            select: {
              status: true,
              firstName: true,
              lastName: true,
              user: {
                select: {
                  roles: { select: { role: { select: { code: true } } } },
                },
              },
            },
          },
        },
      });
      if (!receiverShift || receiverShift.status !== ShiftStatus.OPEN) {
        throw new BadRequestException(
          "Tanlangan kassir smenasi ochiq emas. Ro'yxatni yangilang.",
        );
      }
      if (receiverShift.branchId !== shift.branchId) {
        throw new ForbiddenException(
          "Pulni faqat shu filialdagi kassirga topshirish mumkin",
        );
      }
      if (receiverShift.employeeId === employeeId) {
        throw new BadRequestException(
          "O'zingizning smenangizni qabul qiluvchi sifatida tanlab bo'lmaydi",
        );
      }
      const receiverRoles =
        receiverShift.employee.user?.roles.map((item) => item.role.code) ?? [];
      if (
        receiverShift.employee.status !== "ACTIVE" ||
        !receiverRoles.some((role) =>
          ["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"].includes(role),
        )
      ) {
        throw new BadRequestException(
          "Tanlangan xodim pul qabul qiluvchi kassir emas",
        );
      }

      const transfer = await tx.cashTransfer.create({
        data: {
          branchId: shift.branchId,
          fromShiftId: shift.id,
          toShiftId: receiverShift.id,
          amount,
          reason: dto.reason ?? "Xodim naqd pulni kassirga topshirdi",
          createdById: user.id,
        },
      });

      await this.createTransferAllocations(tx, transfer.id, shift.id, amount);

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
          allocations: this.transferAllocationInclude(),
        },
      });
    });
  }

  async getCashTransferDetail(id: string, user: AuthenticatedUser) {
    const transfer = await this.prisma.cashTransfer.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        fromShift: { include: { employee: true } },
        toShift: { include: { employee: true } },
        allocations: this.transferAllocationInclude(),
      },
    });

    if (!transfer) {
      throw new NotFoundException("Pul topshiruvi topilmadi");
    }

    resolveBranchScope(user, transfer.branchId);
    this.assertCanInspectShift(user, transfer.fromShift.employeeId);
    return transfer;
  }

  async listCashTransferReceivers(user: AuthenticatedUser) {
    const employeeId = user.employeeId;
    if (!employeeId) {
      throw new ForbiddenException(
        "Authenticated user is not linked to an employee",
      );
    }

    const sourceShift = await this.prisma.shift.findFirst({
      where: { employeeId, status: ShiftStatus.OPEN },
      orderBy: { openedAt: "desc" },
      select: { branchId: true },
    });
    if (!sourceShift) return [];

    const branchId = resolveBranchScope(user, sourceShift.branchId);
    const receiverShifts = await this.prisma.shift.findMany({
      where: {
        branchId: branchId ?? sourceShift.branchId,
        status: ShiftStatus.OPEN,
        employeeId: { not: employeeId },
        employee: {
          status: "ACTIVE",
          user: {
            roles: {
              some: {
                role: {
                  code: { in: ["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"] },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        employeeId: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: [{ employee: { firstName: "asc" } }, { openedAt: "asc" }],
    });

    return receiverShifts.map((receiver) => ({
      shiftId: receiver.id,
      employeeId: receiver.employeeId,
      firstName: receiver.employee.firstName,
      lastName: receiver.employee.lastName,
      employeeCode: receiver.employee.employeeCode,
    }));
  }

  async listPendingCashTransfers(user: AuthenticatedUser) {
    this.assertCashReceiver(user);
    const employeeId = user.employeeId;
    if (!employeeId)
      throw new ForbiddenException("Employee profile is required");
    const receiverShift = await this.prisma.shift.findFirst({
      where: { employeeId, status: ShiftStatus.OPEN },
      orderBy: { openedAt: "desc" },
      select: { id: true, branchId: true },
    });
    if (!receiverShift) return [];
    const branchId = resolveBranchScope(user, receiverShift.branchId);
    return this.prisma.cashTransfer.findMany({
      where: {
        status: CashTransferStatus.PENDING,
        fromShift: { employeeId: { not: employeeId } },
        OR: [{ toShiftId: receiverShift.id }, { toShiftId: null }],
        ...(branchId ? { branchId } : {}),
      },
      include: {
        fromShift: { include: { employee: true } },
        toShift: { include: { employee: true } },
        allocations: this.transferAllocationInclude(),
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
        throw new BadRequestException("Xodim smenasi ochiq bo'lishi shart");
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
      if (transfer.toShiftId && transfer.toShiftId !== cashierShift.id) {
        throw new ForbiddenException(
          "Bu topshiriq boshqa kassir smenasiga biriktirilgan",
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
          allocations: this.transferAllocationInclude(),
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
    const receiverEmployeeId = user.employeeId;
    if (!receiverEmployeeId) {
      throw new ForbiddenException("Employee profile is required");
    }
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
      if (transfer.fromShift.employeeId === receiverEmployeeId) {
        throw new ForbiddenException(
          "O'zingizning topshirig'ingizni rad eta olmaysiz",
        );
      }
      if (transfer.toShiftId) {
        const receiverShift = await tx.shift.findFirst({
          where: {
            id: transfer.toShiftId,
            employeeId: receiverEmployeeId,
            status: ShiftStatus.OPEN,
          },
          select: { id: true },
        });
        if (!receiverShift) {
          throw new ForbiddenException(
            "Bu topshiriq boshqa kassir smenasiga biriktirilgan",
          );
        }
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

  /**
   * Free cash is reconstructed as FIFO source buckets. Every debit consumes
   * the oldest remaining source; the new handover snapshots the exact buckets
   * it consumes. This makes partial handovers explainable without rewriting
   * historical orders or payments.
   */
  private async createTransferAllocations(
    tx: Prisma.TransactionClient,
    cashTransferId: string,
    shiftId: string,
    requestedAmount: Prisma.Decimal,
  ) {
    const shift = await tx.shift.findUniqueOrThrow({
      where: { id: shiftId },
      select: { openingBalance: true },
    });
    const transactions = await tx.cashTransaction.findMany({
      where: { shiftId },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        type: true,
        amount: true,
        orderId: true,
        paymentId: true,
        cashTransferId: true,
        reason: true,
        order: {
          select: {
            orderNumber: true,
            displayOrderNumber: true,
          },
        },
        cashTransfer: {
          select: {
            allocations: {
              orderBy: { createdAt: "asc" },
              select: {
                sourceTransactionId: true,
                orderId: true,
                paymentId: true,
                sourceType: true,
                sourceLabel: true,
                amount: true,
              },
            },
          },
        },
      },
    });

    type Bucket = {
      sourceTransactionId: string | null;
      orderId: string | null;
      paymentId: string | null;
      sourceType: string;
      sourceLabel: string | null;
      remaining: Prisma.Decimal;
    };
    const buckets: Bucket[] = [];
    const hasOpeningEntry = transactions.some(
      (item) =>
        item.type === CashTransactionType.OPENING ||
        item.type === CashTransactionType.OPENING_BALANCE,
    );
    if (!hasOpeningEntry && shift.openingBalance.greaterThan(0)) {
      buckets.push({
        sourceTransactionId: null,
        orderId: null,
        paymentId: null,
        sourceType: "OPENING_BALANCE",
        sourceLabel: "Smena boshlang'ich qoldig'i",
        remaining: shift.openingBalance,
      });
    }

    const creditTypes: CashTransactionType[] = [
      CashTransactionType.OPENING,
      CashTransactionType.OPENING_BALANCE,
      CashTransactionType.SALE,
      CashTransactionType.INCOME,
      CashTransactionType.CASH_IN,
    ];
    const debitTypes: CashTransactionType[] = [
      CashTransactionType.REFUND,
      CashTransactionType.EXPENSE,
      CashTransactionType.WITHDRAW,
      CashTransactionType.CASH_OUT,
    ];

    const consume = (amount: Prisma.Decimal) => {
      let remainder = amount;
      for (const bucket of buckets) {
        if (remainder.lessThanOrEqualTo(0)) break;
        if (bucket.remaining.lessThanOrEqualTo(0)) continue;
        const used = Prisma.Decimal.min(bucket.remaining, remainder);
        bucket.remaining = bucket.remaining.sub(used);
        remainder = remainder.sub(used);
      }
      return remainder;
    };

    for (const item of transactions) {
      if (creditTypes.includes(item.type)) {
        if (
          item.type === CashTransactionType.CASH_IN &&
          item.cashTransferId &&
          item.cashTransfer?.allocations.length
        ) {
          for (const allocation of item.cashTransfer.allocations) {
            buckets.push({
              sourceTransactionId: allocation.sourceTransactionId,
              orderId: allocation.orderId,
              paymentId: allocation.paymentId,
              sourceType: allocation.sourceType,
              sourceLabel: allocation.sourceLabel,
              remaining: allocation.amount,
            });
          }
          continue;
        }
        const orderNumber =
          item.order?.displayOrderNumber ?? item.order?.orderNumber;
        buckets.push({
          sourceTransactionId: item.id,
          orderId: item.orderId,
          paymentId: item.paymentId,
          sourceType: item.type,
          sourceLabel: orderNumber
            ? `Buyurtma #${orderNumber}`
            : item.reason?.trim() || this.cashSourceLabel(item.type),
          remaining: item.amount,
        });
      } else if (debitTypes.includes(item.type)) {
        consume(item.amount);
      }
    }

    let remainder = requestedAmount;
    const allocations: Array<{
      cashTransferId: string;
      sourceTransactionId: string | null;
      orderId: string | null;
      paymentId: string | null;
      sourceType: string;
      sourceLabel: string | null;
      amount: Prisma.Decimal;
    }> = [];
    for (const bucket of buckets) {
      if (remainder.lessThanOrEqualTo(0)) break;
      if (bucket.remaining.lessThanOrEqualTo(0)) continue;
      const used = Prisma.Decimal.min(bucket.remaining, remainder);
      allocations.push({
        cashTransferId,
        sourceTransactionId: bucket.sourceTransactionId,
        orderId: bucket.orderId,
        paymentId: bucket.paymentId,
        sourceType: bucket.sourceType,
        sourceLabel: bucket.sourceLabel,
        amount: used,
      });
      remainder = remainder.sub(used);
    }

    if (remainder.greaterThan(0)) {
      throw new BadRequestException(
        "Pul tarkibi joriy qoldiq bilan mos kelmadi. Smenani yangilab qayta urinib ko'ring.",
      );
    }

    if (allocations.length > 0) {
      await tx.cashTransferAllocation.createMany({ data: allocations });
    }
  }

  private cashSourceLabel(type: CashTransactionType): string {
    const labels: Partial<Record<CashTransactionType, string>> = {
      OPENING: "Smena ochilishi",
      OPENING_BALANCE: "Boshlang'ich qoldiq",
      SALE: "Naqd savdo",
      INCOME: "Boshqa kirim",
      CASH_IN: "Xodimdan qabul qilingan naqd",
    };
    return labels[type] ?? type;
  }

  private assertCanInspectShift(
    user: AuthenticatedUser,
    shiftEmployeeId: string,
  ): void {
    if (
      user.employeeId === shiftEmployeeId ||
      user.roles.some((role) =>
        ["SUPER_ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"].includes(role),
      )
    ) {
      return;
    }
    throw new ForbiddenException("Boshqa xodim smenasini ko'rish mumkin emas");
  }

  private transferAllocationInclude() {
    return {
      include: {
        sourceTransaction: {
          select: { id: true, type: true, occurredAt: true, reason: true },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            displayOrderNumber: true,
            total: true,
            createdAt: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            method: { select: { code: true, name: true } },
          },
        },
      },
    } as const;
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
