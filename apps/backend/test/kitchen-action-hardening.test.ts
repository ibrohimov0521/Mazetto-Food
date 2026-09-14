import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import {
  KitchenTicketStatus,
  OrderState,
  OrderStatus,
  OrderType,
  PaymentStatus,
} from "@prisma/client";
import { validate } from "class-validator";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import {
  CancelKitchenTicketActionDto,
  KitchenTicketActionDto,
} from "../src/modules/kitchen/dto/kitchen-action.dto";
import { KitchenActionService } from "../src/modules/kitchen/kitchen-action.service";
import { KitchenService } from "../src/modules/kitchen/kitchen.service";
import { OrdersService } from "../src/modules/orders/orders.service";

const user: AuthenticatedUser = {
  id: "user-1",
  employeeId: "employee-1",
  branchId: "branch-1",
  roles: ["KITCHEN"],
  permissions: ["KITCHEN_VIEW", "KITCHEN_ACCEPT", "KITCHEN_STATUS_UPDATE"],
};

test("kitchen actions require a ticket version and cancellation reason", async () => {
  assert.deepEqual(
    (await validate(new KitchenTicketActionDto())).map(
      ({ property }) => property,
    ),
    ["expectedVersion"],
  );
  const invalidCancel = Object.assign(new CancelKitchenTicketActionDto(), {
    expectedVersion: 1,
  });
  assert.deepEqual(
    (await validate(invalidCancel)).map(({ property }) => property),
    ["reason"],
  );
});

test("kitchen action claims, mutates and completes one idempotency record", async () => {
  const calls: string[] = [];
  const kitchen = {
    applyTicketAction: async (
      ticketId: string,
      action: string,
      _user: AuthenticatedUser,
      _reason: string | undefined,
      context: object,
    ) => {
      calls.push("action");
      assert.equal(ticketId, "ticket-1");
      assert.equal(action, "accept");
      assert.deepEqual(context, {
        expectedVersion: 3,
        correlationId: "correlation-1",
        idempotencyKey: "kitchen-key-1",
      });
      return { ticket: { id: ticketId, status: "ACCEPTED", version: 4 } };
    },
  };
  const idempotency = {
    start: async () => {
      calls.push("claim");
      return { kind: "CLAIMED", record: { id: "idem-1" } };
    },
    complete: async () => calls.push("complete"),
    fail: async () => calls.push("fail"),
  };
  const service = new KitchenActionService(
    kitchen as never,
    idempotency as never,
  );

  const result = await service.accept(
    "ticket-1",
    { expectedVersion: 3 },
    user,
    { correlationId: "correlation-1", idempotencyKey: "kitchen-key-1" },
  );

  assert.equal(result.version, 4);
  assert.deepEqual(calls, ["claim", "action", "complete"]);
});

test("completed kitchen idempotency record replays without mutation", async () => {
  let mutations = 0;
  const kitchen = {
    getTicket: async () => ({ id: "ticket-1", status: "ACCEPTED", version: 2 }),
    applyTicketAction: async () => {
      mutations += 1;
    },
  };
  const idempotency = {
    start: async () => ({
      kind: "REPLAY",
      record: { resourceId: "ticket-1" },
    }),
  };
  const service = new KitchenActionService(
    kitchen as never,
    idempotency as never,
  );

  const result = await service.accept(
    "ticket-1",
    { expectedVersion: 1 },
    user,
    { correlationId: "correlation-2", idempotencyKey: "kitchen-key-2" },
  );

  assert.equal(result.version, 2);
  assert.equal(mutations, 0);
});

test("two devices cannot advance one ticket from the same stale version", async () => {
  const state = createConcurrentKitchenState();
  const service = new KitchenService(
    state.prisma as never,
    state.gateway as never,
  );

  const accepted = await service.applyTicketAction(
    "ticket-1",
    "accept",
    user,
    undefined,
    { expectedVersion: 1 },
  );
  assert.equal(accepted.ticket.version, 2);

  await assert.rejects(
    service.applyTicketAction("ticket-1", "start_preparing", user, undefined, {
      expectedVersion: 1,
    }),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.equal(
        (error.getResponse() as { code: string }).code,
        "KITCHEN_VERSION_CONFLICT",
      );
      return true;
    },
  );
  assert.equal(state.ticketEvents.length, 1);
  assert.equal(state.ticket.status, KitchenTicketStatus.ACCEPTED);
});

test("duplicate accept from two devices creates only one ticket event", async () => {
  const state = createConcurrentKitchenState();
  const service = new KitchenService(
    state.prisma as never,
    state.gateway as never,
  );

  const [first, second] = await Promise.all([
    service.applyTicketAction("ticket-1", "accept", user, undefined, {
      expectedVersion: 1,
    }),
    service.applyTicketAction("ticket-1", "accept", user, undefined, {
      expectedVersion: 1,
    }),
  ]);

  assert.equal(first.ticket.status, KitchenTicketStatus.ACCEPTED);
  assert.equal(second.ticket.status, KitchenTicketStatus.ACCEPTED);
  assert.equal(state.ticketEvents.length, 1);
});

test("cancel and ready racing from two devices produce one terminal decision", async () => {
  const state = createConcurrentKitchenState();
  state.order.status = OrderStatus.PREPARING;
  state.order.orderState = OrderState.ACCEPTED;
  state.order.version = 3;
  state.ticket.status = KitchenTicketStatus.COOKING;
  state.ticket.version = 3;
  const service = new KitchenService(
    state.prisma as never,
    state.gateway as never,
  );

  const results = await Promise.allSettled([
    service.applyTicketAction("ticket-1", "mark_ready", user, undefined, {
      expectedVersion: 3,
    }),
    service.applyTicketAction("ticket-1", "cancel", user, "Mahsulot qolmagan", {
      expectedVersion: 3,
    }),
  ]);

  assert.equal(
    results.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(state.ticketEvents.length, 1);
  const finalTicketStatus = state.ticket.status as KitchenTicketStatus;
  assert.ok(
    finalTicketStatus === KitchenTicketStatus.READY ||
      finalTicketStatus === KitchenTicketStatus.CANCELLED,
  );
});

test("item cancellation updates the snapshot and appends a versioned event", async () => {
  const writes: string[] = [];
  let eventData: Record<string, unknown> | undefined;
  const tx = {
    kitchenTicketItem: {
      findMany: async () => [
        {
          id: "snapshot-1",
          ticketId: "ticket-1",
          ticket: { status: KitchenTicketStatus.COOKING },
        },
      ],
      updateMany: async () => {
        writes.push("snapshot");
        return { count: 1 };
      },
    },
    kitchenTicket: {
      update: async () => {
        writes.push("version");
        return { version: 4 };
      },
    },
    kitchenTicketEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push("event");
        eventData = data;
      },
    },
  };
  const service = new KitchenService({} as never, {} as never);

  await service.recordItemCancellation(tx as never, {
    orderItemId: "item-1",
    actorId: "user-1",
    reason: "Mahsulot qolmagan",
    reasonCode: "OUT_OF_STOCK",
    correlationId: "correlation-3",
    idempotencyKey: "item-key-1",
  });

  assert.deepEqual(writes, ["snapshot", "version", "event"]);
  assert.equal(eventData?.eventType, "KitchenItemCancelled");
  assert.equal(eventData?.orderItemId, "item-1");
  assert.deepEqual(eventData?.payload, { reasonCode: "OUT_OF_STOCK" });
});

test("legacy item PATCH cannot bypass the versioned cancellation action", async () => {
  const orders = new OrdersService({} as never, {} as never, {} as never);
  await assert.rejects(
    orders.updateItem(
      "order-1",
      "item-1",
      { status: "CANCELLED", cancellationReason: "Out of stock" },
      user,
    ),
    /maxsus action endpointidan/,
  );
});

test("hardening migration is additive and snapshots station routing", () => {
  const migration = readFileSync(
    "prisma/migrations/20260914150000_kitchen_action_hardening/migration.sql",
    "utf8",
  );
  assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE)\b/im);
  assert.match(migration, /"stationRouting"/);
  assert.match(migration, /"idempotencyKey"/);
  assert.match(migration, /kitchen_ticket_events_orderItemId_createdAt_idx/);
});

function createConcurrentKitchenState() {
  const order = {
    id: "order-1",
    branchId: "branch-1",
    type: OrderType.DINE_IN,
    status: OrderStatus.NEW as OrderStatus,
    orderState: OrderState.PLACED as OrderState,
    version: 1,
    acceptedAt: null as Date | null,
    acceptedById: null as string | null,
    cancelledAt: null as Date | null,
    cancellationReason: null as string | null,
    paymentStatus: PaymentStatus.PENDING,
    total: { sub: () => ({ lessThanOrEqualTo: () => true }) },
    payments: [],
    customerOrder: null,
  };
  const ticket = {
    id: "ticket-1",
    orderId: order.id,
    status: KitchenTicketStatus.NEW as KitchenTicketStatus,
    version: 1,
    acceptedAt: null as Date | null,
    completedAt: null as Date | null,
  };
  const ticketEvents: Record<string, unknown>[] = [];
  const tx = {
    $queryRaw: async () => [],
    order: {
      findUnique: async () => ({ ...order, kitchenTickets: [{ ...ticket }] }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (data.status) order.status = data.status as OrderStatus;
        if (data.orderState) order.orderState = data.orderState as OrderState;
        if (data.version) order.version += 1;
        if (data.acceptedAt) order.acceptedAt = data.acceptedAt as Date;
        return { ...order };
      },
    },
    orderStatusHistory: { create: async () => undefined },
    orderEvent: {
      create: async () => ({
        id: `event-${order.version}`,
        createdAt: new Date(),
      }),
    },
    outboxEvent: { create: async () => undefined },
    kitchenTicket: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        ticket.status = data.status as KitchenTicketStatus;
        ticket.version += 1;
        if (data.acceptedAt) ticket.acceptedAt = data.acceptedAt as Date;
        return { ...ticket };
      },
      findUnique: async () => ({
        ...ticket,
        order: { ...order },
        items: [],
        events: ticketEvents,
      }),
    },
    kitchenTicketEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        ticketEvents.push(data);
      },
    },
  };
  let tail = Promise.resolve();
  const prisma = {
    kitchenTicket: { findUnique: async () => ({ orderId: order.id }) },
    $transaction: <T>(callback: (client: typeof tx) => Promise<T>) => {
      const result = tail.then(() => callback(tx));
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
  const gateway = { emitOrderStatusChanged: () => undefined };
  return { prisma, gateway, order, ticket, ticketEvents };
}
