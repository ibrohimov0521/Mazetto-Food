import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  resolveBranchScope,
  resolveRequiredBranchScope,
} from "../../common/auth/access-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  ListExpensesDto,
  UpdateExpenseCategoryDto,
} from "./dto/expense.dto";
import { writeAuditLog } from "../audit/audit-write";

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
    const rows = await this.prisma.expenseCategory.findMany({
      where: { isActive: true, ...(branchId ? { branchId } : {}) },
      select: { name: true },
      orderBy: { name: "asc" },
    });

    return [...new Set(rows.map((row) => row.name))];
  }

  listCategoryRecords(user: AuthenticatedUser, requestedBranchId?: string) {
    const branchId = resolveBranchScope(user, requestedBranchId);
    return this.prisma.expenseCategory.findMany({
      where: { isActive: true, ...(branchId ? { branchId } : {}) },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        branchId: true,
        branch: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async createCategory(dto: CreateExpenseCategoryDto, user: AuthenticatedUser) {
    const branchId = resolveRequiredBranchScope(user, dto.branchId);
    const name = this.categoryName(dto.name);
    const normalizedName = this.normalizedCategoryName(name);
    const existing = await this.prisma.expenseCategory.findUnique({
      where: { branchId_normalizedName: { branchId, normalizedName } },
    });
    if (existing) {
      throw new BadRequestException(
        existing.isActive ? "Expense category already exists" : "Expense category is archived",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.expenseCategory.create({
        data: { id: randomUUID(), branchId, name, normalizedName },
      });
      await writeAuditLog(tx, {
        userId: user.id,
        action: "EXPENSE_CATEGORY_CREATED",
        entity: "ExpenseCategory",
        entityId: created.id,
        metadata: { branchId, name },
      });
      return created;
    });
  }

  async updateCategory(
    id: string,
    dto: UpdateExpenseCategoryDto,
    user: AuthenticatedUser,
  ) {
    const category = await this.requireActiveCategory(id, user);
    const name = this.categoryName(dto.name);
    const normalizedName = this.normalizedCategoryName(name);
    const duplicate = await this.prisma.expenseCategory.findFirst({
      where: { branchId: category.branchId, normalizedName, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException("Expense category already exists");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.expenseCategory.update({
        where: { id },
        data: { name, normalizedName },
      });
      await writeAuditLog(tx, {
        userId: user.id,
        action: "EXPENSE_CATEGORY_UPDATED",
        entity: "ExpenseCategory",
        entityId: id,
        metadata: { branchId: category.branchId, previousName: category.name, name },
      });
      return updated;
    });
  }

  async archiveCategory(id: string, user: AuthenticatedUser) {
    const category = await this.requireActiveCategory(id, user);
    return this.prisma.$transaction(async (tx) => {
      const archived = await tx.expenseCategory.update({
        where: { id },
        data: { isActive: false },
      });
      await writeAuditLog(tx, {
        userId: user.id,
        action: "EXPENSE_CATEGORY_ARCHIVED",
        entity: "ExpenseCategory",
        entityId: id,
        metadata: { branchId: category.branchId, name: category.name },
      });
      return archived;
    });
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

    const category = await this.prisma.expenseCategory.findUnique({
      where: {
        branchId_normalizedName: {
          branchId,
          normalizedName: this.normalizedCategoryName(dto.category),
        },
      },
      select: { name: true, isActive: true },
    });
    if (!category?.isActive) {
      throw new BadRequestException("Active expense category not found in this branch");
    }

    return this.prisma.expense.create({
      data: {
        branchId,
        shiftId: dto.shiftId ?? null,
        employeeId: user.employeeId,
        category: category.name,
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

  private categoryName(value: string) {
    const name = value.trim().replace(/\s+/g, " ");
    if (!name) throw new BadRequestException("Expense category name is required");
    return name;
  }

  private normalizedCategoryName(value: string) {
    return this.categoryName(value).toLowerCase();
  }

  private async requireActiveCategory(id: string, user: AuthenticatedUser) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id },
      select: { id: true, name: true, branchId: true, isActive: true },
    });
    if (!category?.isActive) throw new NotFoundException("Active expense category not found");
    resolveRequiredBranchScope(user, category.branchId);
    return category;
  }
}
