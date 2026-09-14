import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { validate } from "class-validator";
import { OrderState, OrderStatus } from "@prisma/client";
import { PERMISSIONS } from "../src/common/auth/permissions";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { OrderActionService } from "../src/modules/orders/order-action.service";
import { CancelOrderActionDto } from "../src/modules/orders/dto/order-action.dto";
import {
  ORDER_EVENTS,
  eventForLegacyStatus,
  orderStateForLegacyStatus,
  recordOrderEvent,
} from "../src/modules/orders/order-events";
import { OrdersService } from "../src/modules/orders/orders.service";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const user: AuthenticatedUser = {
  id: "staff-1",
  employeeId: "employee-1",
  branchId: "branch-1",
  roles: ["CASHIER"],
  permissions: [PERMISSIONS.ORDER_VIEW, PERMISSIONS.ORDER_SEND_KITCHEN, PERMISSIONS.ORDER_UPDATE],
};

test("legacy projection keeps kitchen states separate from the order lifecycle", () => {
  assert.equal(orderStateForLegacyStatus(OrderStatus.NEW), OrderState.PLACED);
  for (const status of [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED]) {
    assert.equal(orderStateForLegacyStatus(status), OrderState.ACCEPTED);
  }
  assert.equal(orderStateForLegacyStatus(OrderStatus.COMPLETED), OrderState.COMPLETED);
  assert.equal(orderStateForLegacyStatus(OrderStatus.CANCELLED), OrderState.CANCELLED);
  assert.equal(eventForLegacyStatus(OrderStatus.CONFIRMED), ORDER_EVENTS.ACCEPTED);
  assert.equal(eventForLegacyStatus(OrderStatus.READY), ORDER_EVENTS.LEGACY_STATUS_CHANGED);
});

test("cancel action requires both an explicit reason and reason code", async () => {
  const invalid = Object.assign(new CancelOrderActionDto(), { expectedVersion: 2 });
  const errors = await validate(invalid);
  assert.deepEqual(errors.map(({ property }) => property).sort(), ["reason", "reasonCode"]);
  const valid = Object.assign(new CancelOrderActionDto(), {
    expectedVersion: 2, reasonCode: "CUSTOMER_REQUEST", reason: "Mijoz so'radi",
  });
  assert.deepEqual(await validate(valid), []);
});

test("order event and publishable outbox entry share identity and correlation", async () => {
  const writes: Array<{ kind: string; data: Record<string, unknown> }> = [];
  const tx = {
    orderEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push({ kind: "event", data });
        return { id: "event-1", createdAt: new Date("2026-09-14T12:00:00.000Z") };
      },
    },
    outboxEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push({ kind: "outbox", data });
      },
    },
  };
  const id = await recordOrderEvent(tx as never, {
    orderId: "order-1",
    branchId: "branch-1",
    aggregateVersion: 2,
    eventType: ORDER_EVENTS.ACCEPTED,
    actorType: "STAFF",
    actorId: user.id,
    source: "API",
    previousState: OrderState.PLACED,
    newState: OrderState.ACCEPTED,
    correlationId: "correlation-1",
    idempotencyKey: "accept-1",
    payload: { fromStatus: "NEW", toStatus: "CONFIRMED" },
  });

  assert.equal(id, "event-1");
  assert.deepEqual(writes.map(({ kind }) => kind), ["event", "outbox"]);
  assert.equal(writes[0]?.data.correlationId, "correlation-1");
  assert.equal(writes[1]?.data.sourceEventId, id);
  assert.equal(writes[1]?.data.correlationId, "correlation-1");
  assert.deepEqual((writes[1]?.data.payload as { data: object }).data, {
    fromStatus: "NEW", toStatus: "CONFIRMED",
  });
});

test("historical order import is additive, versioned and does not publish old events", () => {
  const sql = readFileSync(join(root, "apps/backend/prisma/migrations/20260914103000_order_events/migration.sql"), "utf8");
  assert.match(sql, /ADD COLUMN "orderState"/);
  assert.match(sql, /CREATE TABLE "order_events"/);
  assert.match(sql, /CREATE TABLE "outbox_events"/);
  assert.match(sql, /'OrderImported'/);
  assert.match(sql, /"version",\s*"createdAt"\s*FROM "orders"/);
  assert.doesNotMatch(sql, /INSERT INTO "outbox_events"|DROP TABLE|DROP COLUMN|DELETE FROM/);
});

test("allowed actions enforce permission and hide terminal transitions", async () => {
  let state: OrderState = OrderState.PLACED;
  const orders = { getOrder: async () => ({ id: "order-1", orderState: state, version: 3 }) };
  const actions = new OrderActionService(orders as never, {} as never);
  assert.deepEqual((await actions.allowedActions("order-1", user)).actions, ["accept", "cancel"]);
  assert.deepEqual((await actions.allowedActions("order-1", { ...user, permissions: [] })).actions, []);
  state = OrderState.ACCEPTED;
  assert.deepEqual((await actions.allowedActions("order-1", user)).actions, ["cancel"]);
  state = OrderState.COMPLETED;
  assert.deepEqual((await actions.allowedActions("order-1", user)).actions, []);
});

test("accept action forwards expected version and idempotency key and completes only on success", async () => {
  const calls: string[] = [];
  const orders = {
    updateStatus: async (_id: string, dto: object, _user: object, context: object) => {
      calls.push("order");
      assert.deepEqual(dto, { status: "CONFIRMED" });
      assert.deepEqual(context, {
        expectedVersion: 3,
        correlationId: "correlation-1",
        idempotencyKey: "action-1",
        eventType: ORDER_EVENTS.ACCEPTED,
        reasonCode: "ORDER_ACCEPTED",
        source: "API",
      });
      return { id: "order-1" };
    },
  };
  const idempotency = {
    start: async () => { calls.push("claim"); return { kind: "CLAIMED", record: { id: "idem-1" } }; },
    complete: async () => { calls.push("complete"); },
  };
  const service = new OrderActionService(orders as never, idempotency as never);
  await service.accept("order-1", { expectedVersion: 3 }, user, {
    correlationId: "correlation-1", idempotencyKey: "action-1",
  });
  assert.deepEqual(calls, ["claim", "order", "complete"]);
});

test("failed action releases its idempotency claim for an immediate safe retry", async () => {
  const calls: string[] = [];
  const service = new OrderActionService({
    updateStatus: async () => { calls.push("order"); throw new ConflictException("stale"); },
  } as never, {
    start: async () => ({ kind: "CLAIMED", record: { id: "idem-1" } }),
    complete: async () => { calls.push("complete"); },
    fail: async () => { calls.push("fail"); },
  } as never);
  await assert.rejects(service.accept("order-1", { expectedVersion: 2 }, user, {
    correlationId: "correlation-2", idempotencyKey: "action-2",
  }), ConflictException);
  assert.deepEqual(calls, ["order", "fail"]);
});

test("stale accept version is rejected before mutation and includes current version", async () => {
  const order = { id: "order-1", branchId: "branch-1", status: OrderStatus.NEW, version: 4 };
  let changed = false;
  const tx = {
    $queryRaw: async () => [],
    order: {
      findUnique: async () => order,
      update: async () => { changed = true; },
    },
    employee: { findFirst: async () => ({ id: "employee-1" }) },
    orderEvent: { findFirst: async () => null },
  };
  const prisma = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const service = new OrdersService(prisma as never, {} as never, {} as never);
  await assert.rejects(
    service.updateStatus("order-1", { status: "CONFIRMED" as never }, user, {
      expectedVersion: 3, eventType: ORDER_EVENTS.ACCEPTED, idempotencyKey: "action-1",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.deepEqual((error.getResponse() as { details: object }).details, { currentVersion: 4 });
      return true;
    },
  );
  assert.equal(changed, false);
});

test("cancel writes order state, version, history, event and outbox in one transaction", async () => {
  const writes: string[] = [];
  let stored: { id: string; branchId: string; status: OrderStatus; orderState: OrderState; version: number; tableId: null } = {
    id: "order-1", branchId: "branch-1", status: OrderStatus.NEW,
    orderState: OrderState.PLACED, version: 1, tableId: null,
  };
  const tx = {
    $queryRaw: async () => [],
    order: {
      findUnique: async () => stored,
      update: async ({ data }: { data: { status: OrderStatus; orderState: OrderState } }) => {
        writes.push("order");
        stored = { ...stored, status: data.status, orderState: data.orderState, version: 2 };
        return stored;
      },
    },
    employee: { findFirst: async () => ({ id: "employee-1" }) },
    kitchenTicket: { updateMany: async () => { writes.push("ticket"); } },
    orderStatusHistory: { create: async () => { writes.push("history"); } },
    orderEvent: {
      create: async ({ data }: { data: { aggregateVersion: number; previousState: OrderState } }) => {
        assert.equal(data.aggregateVersion, 2);
        assert.equal(data.previousState, OrderState.PLACED);
        writes.push("event");
        return { id: "event-1", createdAt: new Date() };
      },
    },
    outboxEvent: { create: async () => { writes.push("outbox"); } },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const kitchen = {
    emitOrderStatusChanged: () => undefined,
    emitOrderSentToKitchen: () => undefined,
  };
  const service = new OrdersService(prisma as never, {} as never, kitchen as never);
  const result = await service.updateStatus("order-1", {
    status: "CANCELLED" as never, reason: "Mijoz so'radi",
  }, user, { expectedVersion: 1, eventType: ORDER_EVENTS.CANCELLED, reasonCode: "ADMIN_CANCELLED" });
  assert.equal(result.version, 2);
  assert.equal(result.orderState, OrderState.CANCELLED);
  assert.deepEqual(writes, ["order", "ticket", "history", "event", "outbox"]);
});

test("order detail uses action endpoints, timeline and a stable mutation version", () => {
  const source = readFileSync(join(root, "apps/pos-web/components/admin/admin-orders.tsx"), "utf8");
  assert.match(source, /\/orders\/\$\{orderId\}\/timeline/);
  assert.match(source, /\/orders\/\$\{orderId\}\/allowed-actions/);
  assert.match(source, /"Idempotency-Key": pendingActionKey\.current!\.key/);
  assert.match(source, /pendingActionKey\.current = \{ fingerprint, key: crypto\.randomUUID\(\) \}/);
  assert.match(source, /expectedVersion: actionVersion/);
});
