import assert from "node:assert/strict";
import test from "node:test";
import { classifyOfflineMutation, resolveOfflineCommand } from "../src/commands.js";

const cases = [
  ["PATCH", "/api/v1/kitchen/orders/order-1/accept", "kitchen.action"],
  ["PATCH", "/api/v1/kitchen/orders/order-1/start", "kitchen.action"],
  ["PATCH", "/api/v1/kitchen/orders/order-1/ready", "kitchen.action"],
  ["PATCH", "/api/v1/kitchen/orders/order-1/complete", "kitchen.action"],
  ["PATCH", "/api/v1/kitchen/orders/order-1/cancel", "kitchen.action"],
  ["POST", "/api/v1/orders/order-1/items/item-1/actions/cancel", "order.item.cancel"],
  ["POST", "/api/v1/cash-register/transfers", "cash.transfer.create"],
  ["POST", "/api/v1/cash-register/courier-shift/transfers", "cash.transfer.create"],
  ["POST", "/api/v1/cash-register/transfers/transfer-1/accept", "cash.transfer.action"],
  ["POST", "/api/v1/cash-register/transfers/transfer-1/reject", "cash.transfer.action"],
] as const;

for (const [method, pathname, commandType] of cases) {
  test(`${method} ${pathname} is queued as ${commandType}`, () => {
    assert.equal(resolveOfflineCommand(method, pathname)?.commandType, commandType);
  });
}

test("unsupported kitchen verbs and actions stay online-only", () => {
  assert.equal(
    resolveOfflineCommand("POST", "/api/v1/kitchen/orders/order-1/ready"),
    null,
  );
  assert.equal(
    resolveOfflineCommand("PATCH", "/api/v1/kitchen/orders/order-1/unknown"),
    null,
  );
});

for (const [method, pathname, commandType] of [
  ["POST", "/api/v1/cash-register/shift/shift-1/transactions", "cash.transaction.create"],
  ["POST", "/api/v1/shifts/open", "shift.open"],
  ["POST", "/api/v1/shifts/shift-1/close", "shift.close"],
  ["POST", "/api/v1/shifts/shift-1/cash-transactions", "cash.transaction.create"],
  ["PATCH", "/api/v1/receipts/receipt-1/print", "receipt.mark-printed"],
] as const) {
  test(`${method} ${pathname} is queued as ${commandType}`, () => {
    assert.equal(resolveOfflineCommand(method, pathname)?.commandType, commandType);
  });
}

test("admin mutations are explicitly online-only instead of silently unknown", () => {
  assert.equal(classifyOfflineMutation("POST", "/api/v1/menu/products"), "online-only");
  assert.equal(classifyOfflineMutation("PATCH", "/api/v1/branches/branch-1"), "online-only");
  assert.equal(classifyOfflineMutation("POST", "/api/v1/platform/sites"), "online-only");
  assert.equal(classifyOfflineMutation("POST", "/api/v1/platform/sites/site-1/rotate-token"), "online-only");
  assert.equal(classifyOfflineMutation("POST", "/api/v1/unknown/action"), "unknown");
});
