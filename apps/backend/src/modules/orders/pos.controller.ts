import { Body, Controller, Get, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreatePosCheckoutDto } from "./dto/pos-checkout.dto";
import { OrdersService } from "./orders.service";

@Controller("pos")
export class PosController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get("catalog")
  @Permissions(PERMISSIONS.POS_USE)
  listCatalog(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.listPosCatalog(user);
  }

  @Post("orders")
  @Permissions(PERMISSIONS.POS_USE)
  createOrder(
    @Body() dto: CreatePosCheckoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.createPosCheckout(dto, user);
  }
}
