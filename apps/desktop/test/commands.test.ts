import assert from "node:assert/strict";
import test from "node:test";
import { classifyOfflineMutation, resolveOfflineCommand } from "../src/commands.js";

const cases = [
  ["PATCH", "/api/v1/kitchen/orders/order-1/accept", "kitchen.action"],
  ["PATCH", "/api/v1/kitchen/orders/order-1/start", "kitchen.action"],
  ["PATCH", "/api/v1/kitchen/orders/order-1/ready", "kitchen.action"],
  ["PATCH", "/api/v1/kitchen/orders/order-1/complete", "kitchen.action"],
  ["PATCH", "/api/v1/kitchen/orders/order-1/cancel", "kitchen.action"],
  ["POST", "/api/v1/cash-register/transfers", "cash.transfer.create"],
  ["POST", "/api/v1/cash-register/courier-shift/transfers", "cash.transfer.create"],
] as const;

for (const [method, pathname, commandType] of cases) {
  test(`${method} ${pathname} is queued as ${commandType}`, () => {
    assert.equal(resolveOfflineCommand(method, pathname)?.commandType, commandType);
  });
}

test("waiter supplemental item additions queue offline", () => {
  assert.equal(
    resolveOfflineCommand("POST", "/api/v1/orders/order-1/items")?.commandType,
    "order.items.update",
  );
});

test("waiter item quantity and note edits can queue while destructive actions stay online-only", () => {
  const editPath = "/api/v1/orders/order-1/items/item-1";
  assert.equal(resolveOfflineCommand("PATCH", editPath)?.commandType, "order.items.update");
  assert.equal(classifyOfflineMutation("PATCH", editPath), "queueable");

  for (const [method, pathname] of [
    ["DELETE", editPath],
    ["POST", `${editPath}/actions/cancel`],
  ] as const) {
    assert.equal(resolveOfflineCommand(method, pathname), null);
    assert.equal(classifyOfflineMutation(method, pathname), "online-only");
  }
});

test("offline POS and waiter order creation use the shared order aggregate", () => {
  assert.equal(
    resolveOfflineCommand("POST", "/api/v1/pos/orders")?.aggregateType,
    "orders",
  );
  assert.equal(
    resolveOfflineCommand("POST", "/api/v1/tables/table-1/orders")
      ?.aggregateType,
    "orders",
  );
});

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

test("cash handover acceptance and rejection stay online-only", () => {
  for (const action of ["accept", "reject"]) {
    const path = `/api/v1/cash-register/transfers/transfer-1/${action}`;
    assert.equal(resolveOfflineCommand("POST", path), null);
    assert.equal(classifyOfflineMutation("POST", path), "online-only");
  }
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
