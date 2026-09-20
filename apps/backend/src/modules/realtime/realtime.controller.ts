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
  @PermissionsAny(
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.KITCHEN_VIEW,
    PERMISSIONS.ONLINE_ORDER_VIEW,
    PERMISSIONS.COURIER_DELIVERY_VIEW,
    PERMISSIONS.TABLE_VIEW,
    PERMISSIONS.POS_USE,
  )
  catchUp(
    @Query("cursor") cursor: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("limit") limit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.realtimeService.catchUp(cursor, branchId, limit, user);
  }
}