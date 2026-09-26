import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CorrelationId } from "../../common/decorators/correlation-id.decorator";
import { IdempotencyKey } from "../../common/decorators/idempotency-key.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CancelKitchenTicketActionDto,
  KitchenTicketActionDto,
} from "./dto/kitchen-action.dto";
import { KitchenActionService } from "./kitchen-action.service";
import { KitchenService } from "./kitchen.service";

@Controller("kitchen")
export class KitchenController {
  constructor(
    private readonly kitchenService: KitchenService,
    private readonly kitchenActions: KitchenActionService,
  ) {}

  @Get("orders")
  @Permissions(PERMISSIONS.KITCHEN_VIEW)
  listOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.kitchenService.listOrdersWithOverflow(user);
  }

  @Get("orders/history")
  @Permissions(PERMISSIONS.KITCHEN_VIEW)
  listHistory(
    @Query()
    query: {
      status?: string;
      search?: string;
      limit?: string;
      offset?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kitchenService.listHistory(query, user);
  }

  @Patch("orders/:id/accept")
  @Permissions(PERMISSIONS.KITCHEN_ACCEPT)
  acceptOrder(
    @Param("id") id: string,
    @Body() dto: KitchenTicketActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.kitchenActions.accept(id, dto, user, {
      correlationId,
      idempotencyKey,
    });
  }

  @Patch("orders/:id/start")
  @Permissions(PERMISSIONS.KITCHEN_STATUS_UPDATE)
  startOrder(
    @Param("id") id: string,
    @Body() dto: KitchenTicketActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.kitchenActions.start(id, dto, user, {
      correlationId,
      idempotencyKey,
    });
  }

  @Patch("orders/:id/ready")
  @Permissions(PERMISSIONS.KITCHEN_STATUS_UPDATE)
  readyOrder(
    @Param("id") id: string,
    @Body() dto: KitchenTicketActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.kitchenActions.ready(id, dto, user, {
      correlationId,
      idempotencyKey,
    });
  }

  @Patch("orders/:id/complete")
  @Permissions(PERMISSIONS.KITCHEN_STATUS_UPDATE)
  completeOrder(
    @Param("id") id: string,
    @Body() dto: KitchenTicketActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.kitchenActions.complete(id, dto, user, {
      correlationId,
      idempotencyKey,
    });
  }

  @Patch("orders/:id/cancel")
  @Permissions(PERMISSIONS.KITCHEN_STATUS_UPDATE)
  cancelOrder(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelKitchenTicketActionDto,
    @CorrelationId() correlationId: string,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.kitchenActions.cancel(id, dto, user, {
      correlationId,
      idempotencyKey,
    });
  }
}
