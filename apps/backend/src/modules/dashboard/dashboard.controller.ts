import { Controller, Get, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  @Permissions(PERMISSIONS.DASHBOARD_VIEW)
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query("branchId") branchId?: string,
  ) {
    return this.dashboardService.getSummary(user, branchId);
  }
}
