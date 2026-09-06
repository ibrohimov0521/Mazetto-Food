import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateExpenseDto, ListExpensesDto } from "./dto/expense.dto";
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

  @Post()
  @Permissions(PERMISSIONS.EXPENSE_CREATE)
  createExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.createExpense(dto, user);
  }
}
