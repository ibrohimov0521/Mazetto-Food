import { ConflictException, Injectable } from "@nestjs/common";
import { IdempotencyService } from "../../common/idempotency/idempotency.service";
import {
  buildIdempotencyScope,
  hashCanonicalJson,
} from "../../common/idempotency/idempotency-key";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import type {
  CancelKitchenTicketActionDto,
  CompleteKitchenTicketActionDto,
  KitchenTicketActionDto,
} from "./dto/kitchen-action.dto";
import { KitchenService, type KitchenStaffAction } from "./kitchen.service";

type KitchenActionContext = {
  correlationId: string;
  idempotencyKey: string;
};

@Injectable()
export class KitchenActionService {
  constructor(
    private readonly kitchen: KitchenService,
    private readonly idempotency: IdempotencyService,
  ) {}

  accept(
    ticketId: string,
    dto: KitchenTicketActionDto,
    user: AuthenticatedUser,
    context: KitchenActionContext,
  ) {
    return this.execute(ticketId, "accept", dto, user, context);
  }

  start(
    ticketId: string,
    dto: KitchenTicketActionDto,
    user: AuthenticatedUser,
    context: KitchenActionContext,
  ) {
    return this.execute(ticketId, "start_preparing", dto, user, context);
  }

  ready(
    ticketId: string,
    dto: KitchenTicketActionDto,
    user: AuthenticatedUser,
    context: KitchenActionContext,
  ) {
    return this.execute(ticketId, "mark_ready", dto, user, context);
  }

  complete(
    ticketId: string,
    dto: CompleteKitchenTicketActionDto,
    user: AuthenticatedUser,
    context: KitchenActionContext,
  ) {
    return this.execute(ticketId, "complete", dto, user, context);
  }

  cancel(
    ticketId: string,
    dto: CancelKitchenTicketActionDto,
    user: AuthenticatedUser,
    context: KitchenActionContext,
  ) {
    return this.execute(ticketId, "cancel", dto, user, context);
  }

  private async execute(
    ticketId: string,
    action: KitchenStaffAction,
    dto: KitchenTicketActionDto & { reason?: string; reasonCode?: string; recipientName?: string },
    user: AuthenticatedUser,
    context: KitchenActionContext,
  ) {
    const scope = buildIdempotencyScope("kitchen", action, ticketId);
    const requestHash = hashCanonicalJson({ action, ticketId, dto });
    const decision = await this.idempotency.start({
      scope,
      key: context.idempotencyKey,
      requestHash,
      correlationId: context.correlationId,
      actorId: user.id,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });

    if (decision.kind === "REPLAY") {
      if (decision.record.resourceId !== ticketId) {
        throw new ConflictException("Previous kitchen action did not complete");
      }
      return this.kitchen.getTicket(ticketId, user);
    }

    try {
      const result = await this.kitchen.applyTicketAction(
        ticketId,
        action,
        user,
        dto.reason,
        {
          expectedVersion: dto.expectedVersion,
          ...(action === "complete" && dto.recipientName?.trim()
            ? { recipientName: dto.recipientName.trim() }
            : {}),
          correlationId: context.correlationId,
          idempotencyKey: context.idempotencyKey,
          completeIdempotency: (tx, ticket) =>
            this.idempotency.complete(
              decision.record.id,
              {
                requestHash,
                responseStatus: 200,
                responseBody: {
                  ticketId: ticket.id,
                  status: ticket.status,
                  version: ticket.version,
                },
                resourceType: "KITCHEN_TICKET",
                resourceId: ticket.id,
              },
              tx,
            ),
          ...(dto.reasonCode ? { reasonCode: dto.reasonCode } : {}),
        },
      );
      return result.ticket;
    } catch (error) {
      await this.idempotency
        .fail(decision.record.id, requestHash, "KITCHEN_ACTION_FAILED")
        .catch(() => undefined);
      throw error;
    }
  }
}
