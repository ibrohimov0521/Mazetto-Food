import assert from "node:assert/strict";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { orderStatusLabel } from "../src/common/utils/order-status-label";
import { CustomerCourierService } from "../src/modules/customers/customer-courier.service";

const courier: AuthenticatedUser = {
  id: "courier-user-a",
  employeeId: "courier-employee-a",
  branchId: "branch-a",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  isGlobalScope: false,
  roles: ["COURIER"],
  permissions: ["COURIER_DELIVERY_UPDATE"],
};

function setup(
  status: OrderStatus,
  type: "DELIVERY" | "PICKUP" = "DELIVERY",
  branchId = "branch-a",
  servedById: string | null = null,
) {
  const orderWrites: Record<string, unknown>[] = [];
  const kitchenWrites: Record<string, unknown>[] = [];
  const histories: Record<string, unknown>[] = [];
  const emitted: Record<string, unknown>[] = [];
  const existing = {
    id: "customer-order-a",
    orderId: "order-a",
    branchId,
    type,
    order: {
      status,
      orderState: status,
      version: 1,
      servedById,
      cancelledById: null,
      total: new Prisma.Decimal(74_000),
      payments: [],
    },
  };
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) =>
      strings.join("").includes('UPDATE "branches"')
        ? [{ branchRevision: 1n }]
        : [],
    customerOrder: {
      findFirst: async () => existing,
      findUniqueOrThrow: async () => ({
        ...existing,
        order: { ...existing.order, status: orderWrites.at(-1)?.status ?? status },
      }),
    },
    order: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        orderWrites.push(data);
        return { version: 2, orderState: data.orderState };
      },
    },
    orderEvent: { create: async () => ({ id: "event-a", createdAt: new Date() }) },
    outboxEvent: { create: async () => ({ id: "outbox-a" }) },
    kitchenTicket: {
      updateMany: async (input: Record<string, unknown>) => {
        kitchenWrites.push(input);
        return { count: 1 };
      },
    },
    orderStatusHistory: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        histories.push(data);
        return { id: "history-a" };
      },
    },
    notificationOutbox: { create: async () => ({ id: "notification-a" }) },
  };
  const service = new CustomerCourierService(
    {
      restaurantTenant: { findFirst: async () => ({ id: "tenant-a" }) },
      branch: { findFirst: async () => ({ id: "branch-a" }) },
      $transaction: async (callback: (database: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as never,
    { emitOrderStatusChanged: (input: Record<string, unknown>) => emitted.push(input) } as never,
    {} as never,
  );

  return { service, orderWrites, kitchenWrites, histories, emitted };
}

test("courier READY to SERVED completes the kitchen ticket and records the transition", async () => {
  const state = setup(OrderStatus.READY);

  await state.service.updateCourierOrderStatus(
    "customer-order-a",
    { status: OrderStatus.SERVED } as never,
    courier,
  );

  assert.equal(state.orderWrites.length, 1);
  assert.equal(state.orderWrites[0]?.status, OrderStatus.SERVED);
  const servedBy = state.orderWrites[0]?.servedBy as
    | { connect?: { id?: string } }
    | undefined;
  assert.equal(servedBy?.connect?.id, courier.employeeId);
  assert.equal(state.kitchenWrites.length, 1);
  const kitchenData = state.kitchenWrites[0]?.data as
    | Record<string, unknown>
    | undefined;
  assert.equal(kitchenData?.status, "COMPLETED");
  assert.equal(state.histories[0]?.fromStatus, OrderStatus.READY);
  assert.equal(state.histories[0]?.toStatus, OrderStatus.SERVED);
  assert.deepEqual(state.emitted, [{ orderId: "order-a" }]);
});

test("courier cancellation updates the order, kitchen ticket and history together", async () => {
  const state = setup(OrderStatus.READY);

  await state.service.updateCourierOrderStatus(
    "customer-order-a",
    { status: OrderStatus.CANCELLED } as never,
    courier,
  );

  assert.equal(state.orderWrites[0]?.status, OrderStatus.CANCELLED);
  assert.equal(state.kitchenWrites.length, 1);
  const kitchenData = state.kitchenWrites[0]?.data as
    | Record<string, unknown>
    | undefined;
  assert.equal(kitchenData?.status, "CANCELLED");
  assert.equal(state.histories[0]?.fromStatus, OrderStatus.READY);
  assert.equal(state.histories[0]?.toStatus, OrderStatus.CANCELLED);
});

test("courier rejects invalid, non-delivery, cross-branch and foreign-owned transitions before writes", async () => {
  const rejected = [
    { state: setup(OrderStatus.PREPARING), next: OrderStatus.SERVED, error: BadRequestException },
    { state: setup(OrderStatus.SERVED), next: OrderStatus.READY, error: BadRequestException },
    { state: setup(OrderStatus.COMPLETED), next: OrderStatus.SERVED, error: BadRequestException },
    { state: setup(OrderStatus.CANCELLED), next: OrderStatus.SERVED, error: BadRequestException },
    { state: setup(OrderStatus.READY, "PICKUP"), next: OrderStatus.SERVED, error: BadRequestException },
    { state: setup(OrderStatus.READY, "DELIVERY", "branch-b"), next: OrderStatus.SERVED, error: ForbiddenException },
    { state: setup(OrderStatus.READY, "DELIVERY", "branch-a", "another-courier"), next: OrderStatus.SERVED, error: ForbiddenException },
  ];

  for (const entry of rejected) {
    await assert.rejects(
      entry.state.service.updateCourierOrderStatus(
        "customer-order-a",
        { status: entry.next } as never,
        courier,
      ),
      entry.error,
    );
    assert.equal(entry.state.orderWrites.length, 0);
    assert.equal(entry.state.emitted.length, 0);
  }
});

test("replaying the current courier status does not write the order or kitchen ticket", async () => {
  const state = setup(OrderStatus.SERVED, "DELIVERY", "branch-a", courier.employeeId);

  await state.service.updateCourierOrderStatus(
    "customer-order-a",
    { status: OrderStatus.SERVED } as never,
    courier,
  );

  assert.equal(state.orderWrites.length, 0);
  assert.equal(state.kitchenWrites.length, 0);
  assert.equal(state.histories.length, 0);
});

test("customer-facing order labels cover lifecycle states and delivery-specific handoff", () => {
  for (const type of ["DELIVERY", "PICKUP"]) {
    for (const status of [
      "NEW",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "SERVED",
      "COMPLETED",
      "CANCELLED",
    ]) {
      assert.equal(typeof orderStatusLabel(status, type), "string");
    }
  }

  assert.match(orderStatusLabel("SERVED", "DELIVERY"), /Kuryer yo'lda/);
  assert.match(orderStatusLabel("SERVED", "PICKUP"), /Topshirildi/);
  assert.match(orderStatusLabel("COMPLETED", "DELIVERY"), /Yetkazildi/);
});
