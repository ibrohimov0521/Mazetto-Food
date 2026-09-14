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
import { CorrelationId } from "../../common/decorators/correlation-id.decorator";
import { IdempotencyKey } from "../../common/decorators/idempotency-key.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateOrderDto } from "./dto/create-order.dto";
import {
  AcceptOrderActionDto,
  CancelOrderActionDto,
} from "./dto/order-action.dto";
import { ListOrdersDto } from "./dto/list-orders.dto";
import {
  AddOrderItemDto,
  CancelOrderItemActionDto,
  UpdateOrderItemDto,
} from "./dto/order-item.dto";
import {
  BulkUpdateOrderStatusDto,
  UpdateOrderStatusDto,
} from "./dto/order-status.dto";
import { OrdersService } from "./orders.service";
import { OrderActionService } from "./order-action.service";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderActions: OrderActionService,
  ) {}

  @Post()
  @Permissions(PERMISSIONS.ORDER_CREATE)
  createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.ordersService.createOrder(dto, user, correlationId);
  }

  @Get()
  @Permissions(PERMISSIONS.ORDER_VIEW)
  listOrders(
    @Query() query: ListOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.listOrders(query, user);
  }

  @Patch("bulk/status")
  @Permissions(PERMISSIONS.ORDER_SEND_KITCHEN)
  bulkUpdateStatus(
    @Body() dto: BulkUpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.ordersService.bulkUpdateStatus(dto, user, correlationId);
  }

  @Get(":id/timeline")
  @Permissions(PERMISSIONS.ORDER_VIEW)
  getTimeline(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orderActions.timeline(id, user);
  }

  @Get(":id/allowed-actions")
  @Permissions(PERMISSIONS.ORDER_VIEW)
  getAllowedActions(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orderActions.allowedActions(id, user);
  }

  @Post(":id/actions/accept")
  @Permissions(PERMISSIONS.ORDER_SEND_KITCHEN)
  acceptOrder(
    @Param("id") id: string,
    @Body() dto: AcceptOrderActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.orderActions.accept(id, dto, user, {
      correlationId,
      idempotencyKey,
    });
  }

  @Post(":id/actions/cancel")
  @Permissions(PERMISSIONS.ORDER_UPDATE)
  cancelOrder(
    @Param("id") id: string,
    @Body() dto: CancelOrderActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.orderActions.cancel(id, dto, user, {
      correlationId,
      idempotencyKey,
    });
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

  @Post(":id/items/:itemId/actions/cancel")
  @Permissions(PERMISSIONS.ORDER_UPDATE)
  cancelItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: CancelOrderItemActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.orderActions.cancelItem(id, itemId, dto, user, {
      correlationId,
      idempotencyKey,
    });
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
    @CorrelationId() correlationId: string,
  ) {
    return this.ordersService.updateStatus(id, dto, user, {
      correlationId,
      source: "API",
    });
  }
}
