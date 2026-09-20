import { Controller, Get, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RealtimeService } from "./realtime.service";

@Controller("realtime")
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Get("events")
  @Permissions(PERMISSIONS.ORDER_VIEW)
  catchUp(
    @Query("cursor") cursor: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("limit") limit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.realtimeService.catchUp(cursor, branchId, limit, user);
  }
}