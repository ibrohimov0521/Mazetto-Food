import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  ListExpensesDto,
  UpdateExpenseCategoryDto,
} from "./dto/expense.dto";
import { ExpensesService } from "./expenses.service";

@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @Permissions(PERMISSIONS.REPORT_EXPENSES_VIEW)
  listExpenses(
    @Query() query: ListExpensesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.listExpenses(query, user);
  }

  @Get("categories")
  @Permissions(PERMISSIONS.REPORT_EXPENSES_VIEW)
  listCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.listCategories(user);
  }

  @Get("category-records")
  @Permissions(PERMISSIONS.REPORT_EXPENSES_VIEW)
  listCategoryRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query("branchId") branchId?: string,
  ) {
    return this.expensesService.listCategoryRecords(user, branchId);
  }

  @Post("categories")
  @Permissions(PERMISSIONS.EXPENSE_CREATE)
  createCategory(
    @Body() dto: CreateExpenseCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.createCategory(dto, user);
  }

  @Patch("categories/:id")
  @Permissions(PERMISSIONS.EXPENSE_CREATE)
  updateCategory(
    @Param("id") id: string,
    @Body() dto: UpdateExpenseCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.updateCategory(id, dto, user);
  }

  @Delete("categories/bulk/permanent")
  @Permissions(PERMISSIONS.EXPENSE_CREATE)
  permanentlyDeleteCategories(
    @Body() dto: { ids: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.permanentlyDeleteCategories(dto.ids, user);
  }

  @Delete("categories/:id")
  @Permissions(PERMISSIONS.EXPENSE_CREATE)
  archiveCategory(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.archiveCategory(id, user);
  }

  @Post()
  @Permissions(PERMISSIONS.EXPENSE_CREATE)
  createExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.createExpense(dto, user);
  }
}
