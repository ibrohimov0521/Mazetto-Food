import assert from "node:assert/strict";
import test from "node:test";
import {
  KitchenTicketStatus,
  OrderItemStatus,
  Prisma,
  StockMovementType,
} from "@prisma/client";
import type { InventoryService } from "../src/modules/inventory/inventory.service";
import {
  restoreUnstartedOrderItemStock,
  restoreUnstartedOrderStock,
} from "../src/modules/orders/order-stock-cancellation";

const deduction = {
  id: "movement-out-1",
  ingredientId: "ingredient-1",
  warehouseId: "warehouse-1",
  quantity: new Prisma.Decimal("-0.250"),
};

function fixture(ticketStatuses: string[]) {
  const calls: unknown[] = [];
  let movementQueries = 0;
  let orderItemQuery: unknown;
  const tx = {
    kitchenTicketItem: {
      findMany: async () =>
        ticketStatuses.map((status) => ({ ticket: { status } })),
    },
    stockMovement: {
      findMany: async () => {
        movementQueries += 1;
        return [deduction];
      },
    },
    orderItem: {
      findMany: async (query: unknown) => {
        orderItemQuery = query;
        return [{ id: "deducted-item" }];
      },
    },
  } as never;
  const inventory = {
    applyStockMovement: async (_tx: unknown, data: unknown) => {
      calls.push(data);
    },
  } as unknown as InventoryService;

  return {
    tx,
    inventory,
    calls,
    get movementQueries() { return movementQueries; },
    get orderItemQuery() { return orderItemQuery; },
  };
}

test("unstarted item cancellation reverses the exact recipe deduction", async () => {
  const state = fixture([KitchenTicketStatus.NEW]);

  const count = await restoreUnstartedOrderItemStock(
    state.tx,
    state.inventory,
    {
      orderId: "order-1",
      orderItemId: "item-1",
      actorId: "user-1",
      reason: "Mijoz bekor qildi",
    },
  );

  assert.equal(count, 1);
  assert.deepEqual(state.calls, [
    {
      ingredientId: "ingredient-1",
      warehouseId: "warehouse-1",
      type: StockMovementType.IN,
      quantity: new Prisma.Decimal("0.250"),
      reason: "Unstarted order item cancellation: Mijoz bekor qildi",
      createdById: "user-1",
      orderItemId: "item-1",
      sourceType: "ORDER_ITEM_RECIPE_RESTOCK",
      sourceId: "order-1",
      sourceItemId: "movement-out-1",
    },
  ]);
});

test("accepted, cooking, or unlinked kitchen items are never restocked", async () => {
  for (const statuses of [
    [KitchenTicketStatus.ACCEPTED],
    [KitchenTicketStatus.COOKING],
    [],
  ]) {
    const state = fixture(statuses);
    const count = await restoreUnstartedOrderItemStock(
      state.tx,
      state.inventory,
      {
        orderId: "order-1",
        orderItemId: "item-1",
        actorId: "user-1",
        reason: "Bekor qilindi",
      },
    );

    assert.equal(count, 0);
    assert.equal(state.calls.length, 0);
    assert.equal(state.movementQueries, 0);
  }
});

test("whole-order cancellation checks only active items with prior deductions", async () => {
  const state = fixture([KitchenTicketStatus.NEW]);

  const count = await restoreUnstartedOrderStock(
    state.tx,
    state.inventory,
    {
      orderId: "order-1",
      actorId: "user-1",
      reason: "Buyurtma bekor qilindi",
    },
  );

  assert.equal(count, 1);
  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.orderItemQuery, {
    where: {
      orderId: "order-1",
      status: OrderItemStatus.ACTIVE,
      stockDeductedAt: { not: null },
    },
    select: { id: true },
  });
});
