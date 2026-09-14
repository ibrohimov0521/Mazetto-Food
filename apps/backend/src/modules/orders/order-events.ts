import { randomUUID } from "node:crypto";
import { type OrderState, Prisma } from "@prisma/client";

export const ORDER_EVENTS = {
  PLACED: "OrderPlaced",
  ACCEPTED: "OrderAccepted",
  REJECTED: "OrderRejected",
  CANCELLED: "OrderCancelled",
  COMPLETED: "OrderCompleted",
  ITEM_ADDED: "OrderItemAdded",
  ITEM_UPDATED: "OrderItemUpdated",
  ITEM_CANCELLED: "OrderItemCancelled",
  LEGACY_STATUS_CHANGED: "OrderLegacyStatusChanged",
} as const;

export type OrderEventName = (typeof ORDER_EVENTS)[keyof typeof ORDER_EVENTS];

export type RecordOrderEventInput = {
  orderId: string;
  branchId: string;
  aggregateVersion: number;
  eventType: OrderEventName;
  actorType: "STAFF" | "CUSTOMER" | "SYSTEM";
  actorId?: string | null | undefined;
  source: "POS" | "CUSTOMER_WEB" | "TELEGRAM" | "API" | "SYSTEM";
  previousState?: OrderState | null | undefined;
  newState?: OrderState | null | undefined;
  payload?: Prisma.InputJsonValue | undefined;
  reasonCode?: string | null | undefined;
  correlationId?: string | undefined;
  causationId?: string | null | undefined;
  idempotencyKey?: string | null | undefined;
  publish?: boolean | undefined;
};

export async function recordOrderEvent(
  tx: Prisma.TransactionClient,
  input: RecordOrderEventInput,
): Promise<string> {
  const correlationId = input.correlationId ?? randomUUID();
  const event = await tx.orderEvent.create({
    data: {
      orderId: input.orderId,
      branchId: input.branchId,
      aggregateVersion: input.aggregateVersion,
      eventType: input.eventType,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      source: input.source,
      previousState: input.previousState ?? null,
      newState: input.newState ?? null,
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
      reasonCode: input.reasonCode ?? null,
      correlationId,
      causationId: input.causationId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  if (input.publish !== false) {
    await tx.outboxEvent.create({
      data: {
        sourceEventId: event.id,
        branchId: input.branchId,
        aggregateType: "ORDER",
        aggregateId: input.orderId,
        eventType: input.eventType,
        correlationId,
        causationId: input.causationId ?? null,
        payload: {
          eventId: event.id,
          eventType: input.eventType,
          aggregateType: "ORDER",
          aggregateId: input.orderId,
          aggregateVersion: input.aggregateVersion,
          branchId: input.branchId,
          occurredAt: event.createdAt.toISOString(),
          data: input.payload ?? {},
        },
      },
    });
  }

  return event.id;
}

export function orderStateForLegacyStatus(
  status:
    | "NEW"
    | "CONFIRMED"
    | "PREPARING"
    | "READY"
    | "SERVED"
    | "COMPLETED"
    | "CANCELLED",
): OrderState {
  if (status === "NEW") return "PLACED";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
  return "ACCEPTED";
}

export function eventForLegacyStatus(
  status:
    | "NEW"
    | "CONFIRMED"
    | "PREPARING"
    | "READY"
    | "SERVED"
    | "COMPLETED"
    | "CANCELLED",
): OrderEventName {
  if (status === "CONFIRMED") return ORDER_EVENTS.ACCEPTED;
  if (status === "COMPLETED") return ORDER_EVENTS.COMPLETED;
  if (status === "CANCELLED") return ORDER_EVENTS.CANCELLED;
  return ORDER_EVENTS.LEGACY_STATUS_CHANGED;
}
