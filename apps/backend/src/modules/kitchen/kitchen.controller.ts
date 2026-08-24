import { Controller, Get, Param, Patch } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { KitchenService } from "./kitchen.service";

@Controller("kitchen")
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get("orders")
  @Permissions(PERMISSIONS.KITCHEN_VIEW)
  listOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.kitchenService.listOrders(user);
  }

  @Patch("orders/:id/accept")
  @Permissions(PERMISSIONS.KITCHEN_ACCEPT)
  acceptOrder(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.kitchenService.acceptTicket(id, user);
  }

  @Patch("orders/:id/start")
  @Permissions(PERMISSIONS.KITCHEN_STATUS_UPDATE)
  startOrder(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.kitchenService.startTicket(id, user);
  }

  @Patch("orders/:id/ready")
  @Permissions(PERMISSIONS.KITCHEN_STATUS_UPDATE)
  readyOrder(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.kitchenService.readyTicket(id, user);
  }

  @Patch("orders/:id/complete")
  @Permissions(PERMISSIONS.KITCHEN_STATUS_UPDATE)
  completeOrder(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kitchenService.completeTicket(id, user);
  }
}
