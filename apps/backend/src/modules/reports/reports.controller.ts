import { Controller, Get, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ProductReportQueryDto, ReportQueryDto } from "./dto/report-query.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("sales")
  @Permissions(PERMISSIONS.REPORT_SALES_VIEW)
  getSalesReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getSalesReport(query, user);
  }

  @Get("products")
  @Permissions(PERMISSIONS.REPORT_PRODUCTS_VIEW)
  getProductReport(
    @Query() query: ProductReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getProductReport(query, user);
  }

  @Get("employees")
  @Permissions(PERMISSIONS.REPORT_EMPLOYEES_VIEW)
  getEmployeeReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getEmployeeReport(query, user);
  }

  @Get("expenses")
  @Permissions(PERMISSIONS.REPORT_EXPENSES_VIEW)
  getExpenseReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getExpenseReport(query, user);
  }

  @Get("z")
  @Permissions(PERMISSIONS.REPORT_SALES_VIEW)
  getZReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getZReport(query, user);
  }
}
