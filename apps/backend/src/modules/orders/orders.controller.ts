import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListOrdersDto } from "./dto/list-orders.dto";
import { AddOrderItemDto, UpdateOrderItemDto } from "./dto/order-item.dto";
import { UpdateOrderStatusDto } from "./dto/order-status.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Permissions(PERMISSIONS.ORDER_CREATE)
  createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.createOrder(dto, user);
  }

  @Get()
  @Permissions(PERMISSIONS.ORDER_VIEW)
  listOrders(
    @Query() query: ListOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.listOrders(query, user);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.ORDER_VIEW)
  getOrder(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.getOrder(id, user);
  }

  @Post(":id/items")
  @Permissions(PERMISSIONS.ORDER_UPDATE)
  addItem(
    @Param("id") id: string,
    @Body() dto: AddOrderItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.addItem(id, dto, user);
  }

  @Patch(":id/items/:itemId")
  @Permissions(PERMISSIONS.ORDER_UPDATE)
  updateItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateOrderItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.updateItem(id, itemId, dto, user);
  }

  @Patch(":id/status")
  @Permissions(PERMISSIONS.ORDER_SEND_KITCHEN)
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.updateStatus(id, dto, user);
  }
}
