import assert from "node:assert/strict";
import test from "node:test";
import { matchesOrderUpdate, orderUpdateId } from "../lib/order-update-payload.mjs";

test("order update IDs are read from each realtime payload shape", () => {
  assert.equal(orderUpdateId({ orderId: "order-a" }), "order-a");
  assert.equal(orderUpdateId({ id: "order-a" }), null);
  assert.equal(orderUpdateId({ order: { id: "order-b" } }), "order-b");
  assert.equal(
    orderUpdateId({ action: "READY", order: { id: "order-c" }, ticket: {} }),
    "order-c",
  );
  assert.equal(orderUpdateId({ ticket: { orderId: "order-d" } }), "order-d");
  assert.equal(orderUpdateId({ ticket: { order: { id: "order-e" } } }), "order-e");
  assert.equal(orderUpdateId(null), null);
});

test("order-specific subscriptions accept only their own event and unfiltered lists accept all", () => {
  assert.equal(matchesOrderUpdate({ order: { id: "order-a" } }, "order-a"), true);
  assert.equal(matchesOrderUpdate({ order: { id: "order-b" } }, "order-a"), false);
  assert.equal(matchesOrderUpdate({ status: "READY" }, "order-a"), false);
  assert.equal(matchesOrderUpdate({ status: "READY" }, undefined), true);
  assert.equal(matchesOrderUpdate({ orderId: "order-a" }, null), false);
});
