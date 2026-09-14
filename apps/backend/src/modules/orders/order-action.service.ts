import { ConflictException, Injectable } from "@nestjs/common";
import { PosOrderStatus } from "./dto/order-status.dto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { hasPermission } from "../../common/auth/authorization";
import { PERMISSIONS } from "../../common/auth/permissions";
import { IdempotencyService } from "../../common/idempotency/idempotency.service";
import {
  buildIdempotencyScope,
  hashCanonicalJson,
} from "../../common/idempotency/idempotency-key";
import type {
  AcceptOrderActionDto,
  CancelOrderActionDto,
} from "./dto/order-action.dto";
import { ORDER_EVENTS } from "./order-events";
import { OrdersService } from "./orders.service";

type ActionContext = {
  correlationId: string;
  idempotencyKey: string;
};

@Injectable()
export class OrderActionService {
  constructor(
    private readonly orders: OrdersService,
    private readonly idempotency: IdempotencyService,
  ) {}

  accept(
    orderId: string,
    dto: AcceptOrderActionDto,
    user: AuthenticatedUser,
    context: ActionContext,
  ) {
    return this.runIdempotent("accept", orderId, dto, user, context, () =>
      this.orders.updateStatus(
        orderId,
        {
          status: PosOrderStatus.CONFIRMED,
          ...(dto.reason ? { reason: dto.reason } : {}),
        },
        user,
        {
          expectedVersion: dto.expectedVersion,
          correlationId: context.correlationId,
          idempotencyKey: context.idempotencyKey,
          eventType: ORDER_EVENTS.ACCEPTED,
          reasonCode: "ORDER_ACCEPTED",
          source: "API",
        },
      ),
    );
  }

  cancel(
    orderId: string,
    dto: CancelOrderActionDto,
    user: AuthenticatedUser,
    context: ActionContext,
  ) {
    return this.runIdempotent("cancel", orderId, dto, user, context, () =>
      this.orders.updateStatus(
        orderId,
        { status: PosOrderStatus.CANCELLED, reason: dto.reason },
        user,
        {
          expectedVersion: dto.expectedVersion,
          correlationId: context.correlationId,
          idempotencyKey: context.idempotencyKey,
          eventType: ORDER_EVENTS.CANCELLED,
          reasonCode: dto.reasonCode,
          source: "API",
        },
      ),
    );
  }

  async allowedActions(orderId: string, user: AuthenticatedUser) {
    const order = await this.orders.getOrder(orderId, user);
    const terminal =
      order.orderState === "COMPLETED" || order.orderState === "CANCELLED";
    const actions: string[] = [];

    if (
      order.orderState === "PLACED" &&
      hasPermission(user, PERMISSIONS.ORDER_SEND_KITCHEN)
    ) {
      actions.push("accept");
    }
    if (!terminal && hasPermission(user, PERMISSIONS.ORDER_UPDATE)) {
      actions.push("cancel");
    }

    return {
      orderId,
      version: order.version,
      orderState: order.orderState,
      actions,
    };
  }

  timeline(orderId: string, user: AuthenticatedUser) {
    return this.orders.getTimeline(orderId, user);
  }

  private async runIdempotent<T extends { id: string }>(
    action: string,
    orderId: string,
    dto: object,
    user: AuthenticatedUser,
    context: ActionContext,
    operation: () => Promise<T>,
  ): Promise<T> {
    const scope = buildIdempotencyScope("orders", action, orderId);
    const requestHash = hashCanonicalJson({ action, orderId, dto });
    const decision = await this.idempotency.start({
      scope,
      key: context.idempotencyKey,
      requestHash,
      correlationId: context.correlationId,
      actorId: user.id,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });

    if (decision.kind === "REPLAY") {
      if (!decision.record.resourceId) {
        throw new ConflictException(
          "Previous idempotent action did not complete",
        );
      }
      return this.orders.getOrder(
        decision.record.resourceId,
        user,
      ) as unknown as Promise<T>;
    }

    try {
      const result = await operation();
      await this.idempotency.complete(decision.record.id, {
        requestHash,
        responseStatus: 200,
        responseBody: { orderId: result.id },
        resourceType: "ORDER",
        resourceId: result.id,
      });
      return result;
    } catch (error) {
      await this.idempotency.fail(decision.record.id, requestHash, "ORDER_ACTION_FAILED").catch(() => undefined);
      throw error;
    }
  }
}
