import { Controller, Get, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PermissionsAny } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RealtimeService } from "./realtime.service";

@Controller("realtime")
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Get("events")
  @PermissionsAny(\n    PERMISSIONS.ORDER_VIEW,\n    PERMISSIONS.KITCHEN_VIEW,\n    PERMISSIONS.ONLINE_ORDER_VIEW,\n    PERMISSIONS.COURIER_DELIVERY_VIEW,\n    PERMISSIONS.TABLE_VIEW,\n    PERMISSIONS.POS_USE,\n  )
  catchUp(
    @Query("cursor") cursor: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("limit") limit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.realtimeService.catchUp(cursor, branchId, limit, user);
  }
}