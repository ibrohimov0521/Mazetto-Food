import assert from "node:assert/strict";
import test from "node:test";
import { KitchenTicketStatus, OrderStatus } from "@prisma/client";
import { kitchenStatusForOrder } from "../src/modules/kitchen/kitchen-status-sync";

test("kitchen tickets follow the canonical order status mapping", () => {
  const cases: Array<[OrderStatus, KitchenTicketStatus | null]> = [
    [OrderStatus.NEW, null],
    [OrderStatus.CONFIRMED, KitchenTicketStatus.ACCEPTED],
    [OrderStatus.PREPARING, KitchenTicketStatus.COOKING],
    [OrderStatus.READY, KitchenTicketStatus.READY],
    [OrderStatus.SERVED, KitchenTicketStatus.COMPLETED],
    [OrderStatus.COMPLETED, KitchenTicketStatus.COMPLETED],
    [OrderStatus.CANCELLED, KitchenTicketStatus.CANCELLED],
  ];

  for (const [orderStatus, expectedTicketStatus] of cases) {
    assert.equal(kitchenStatusForOrder(orderStatus), expectedTicketStatus);
  }
});

test("every terminal order status maps to a terminal kitchen ticket status", () => {
  const terminalStatuses = [
    OrderStatus.SERVED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ];
  const terminalTicketStatuses: KitchenTicketStatus[] = [
    KitchenTicketStatus.COMPLETED,
    KitchenTicketStatus.CANCELLED,
  ];

  for (const orderStatus of terminalStatuses) {
    const ticketStatus = kitchenStatusForOrder(orderStatus);

    assert.ok(ticketStatus);
    assert.ok(terminalTicketStatuses.includes(ticketStatus));
  }
});
