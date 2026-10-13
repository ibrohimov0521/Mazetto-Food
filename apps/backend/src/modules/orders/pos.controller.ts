import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CorrelationId } from "../../common/decorators/correlation-id.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreatePosCheckoutDto } from "./dto/pos-checkout.dto";
import { OrdersService } from "./orders.service";

@Controller("pos")
export class PosController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get("catalog")
  @Permissions(PERMISSIONS.POS_USE)
  listCatalog(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("x-mazetto-device-id") deviceHardwareId?: string,
  ) {
    return this.ordersService.listPosCatalog(user, deviceHardwareId);
  }

  @Post("orders")
  @Permissions(PERMISSIONS.POS_USE)
  createOrder(
    @Body() dto: CreatePosCheckoutDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
    @Headers("x-mazetto-device-id") deviceHardwareId?: string,
  ) {
    return this.ordersService.createPosCheckout(
      dto,
      user,
      correlationId,
      deviceHardwareId,
    );
  }
}
