import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  resolveBranchScope,
  resolveRequiredBranchScope,
} from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateExpenseDto, ListExpensesDto } from "./dto/expense.dto";

/*
 * Xarajatlar.
 *
 * `Expense` modeli allaqachon bor edi va `/reports/expenses` uni o'qirdi,
 * lekin xarajat YOZISH uchun endpoint yo'q edi — ya'ni ma'lumot faqat
 * bazaga qo'lda kiritilishi mumkin edi.
 *
 * `Shift.expensesTotal` maydoni ham allaqachon mavjud, ya'ni xarajat
 * smena kassa oqimining bir qismi sifatida modellashtirilgan.
 */
@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  listExpenses(query: ListExpensesDto, user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user, query.branchId);
    const expenseDate =
      query.from || query.to
        ? {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          }
        : undefined;

    return this.prisma.expense.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(query.shiftId ? { shiftId: query.shiftId } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(expenseDate ? { expenseDate } : {}),
      },
      orderBy: { expenseDate: "desc" },
      skip: query.offset,
      take: query.limit,
      select: {
        id: true,
        category: true,
        amount: true,
        description: true,
        expenseDate: true,
        createdAt: true,
        shiftId: true,
        branch: { select: { id: true, code: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Filtr tanlagichi uchun mavjud kategoriyalar. */
  async listCategories(user: AuthenticatedUser) {
    const branchId = resolveBranchScope(user);
    const rows = await this.prisma.expense.findMany({
      where: branchId ? { branchId } : {},
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });

    return rows.map((row) => row.category);
  }

  async createExpense(dto: CreateExpenseDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);

    if (!user.employeeId) {
      throw new ForbiddenException("Authenticated user is not linked to an employee");
    }

    /*
     * Smena berilsa, u SHU filialga tegishli va OCHIQ bo'lishi shart.
     * Yopilgan smenaga xarajat qo'shish uning yakuniy hisobini buzadi.
     */
    if (dto.shiftId) {
      const shift = await this.prisma.shift.findUnique({
        where: { id: dto.shiftId },
        select: { id: true, branchId: true, status: true },
      });

      if (!shift || shift.branchId !== branchId) {
        throw new BadRequestException("Shift not found in this branch");
      }

      if (shift.status !== "OPEN") {
        throw new BadRequestException("Cannot add an expense to a closed shift");
      }
    }

    return this.prisma.expense.create({
      data: {
        branchId,
        shiftId: dto.shiftId ?? null,
        employeeId: user.employeeId,
        category: dto.category.trim(),
        amount: new Prisma.Decimal(dto.amount),
        description: dto.description ?? null,
        ...(dto.expenseDate ? { expenseDate: new Date(dto.expenseDate) } : {}),
      },
      select: {
        id: true,
        category: true,
        amount: true,
        description: true,
        expenseDate: true,
        shiftId: true,
        branch: { select: { id: true, code: true, name: true } },
      },
    });
  }
}
