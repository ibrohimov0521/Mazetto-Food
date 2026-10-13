import assert from "node:assert/strict";
import test from "node:test";
import { receiptDisplaySnapshot } from "../../pos-web/components/admin/receipt-snapshot";

test("receipt detail prefers immutable item, payment, and order snapshots", () => {
  const display = receiptDisplaySnapshot(
    {
      displayOrderNumber: "M-101",
      items: [{
        name: "Original lavash",
        variant: "Katta",
        quantity: "2",
        total: "72000.00",
        notes: "Achchiq bo'lsin",
        modifiers: [{ name: "Pishloq" }],
      }],
      payments: [{ method: "CASH", amount: "72000.00" }],
    },
    {
      items: [{ id: "edited-item", productName: "Changed drink", quantity: "1", totalPrice: "12000.00" }],
      payments: [{ id: "refunded-payment", amount: "12000.00", method: { code: "CARD", name: "Card" } }],
    },
  );
  assert.equal(display.orderNumber, "M-101");
  assert.deepEqual(display.items, [{
    key: "snapshot-item-0",
    name: "Original lavash",
    variant: "Katta",
    quantity: "2",
    total: "72000.00",
    notes: "Achchiq bo'lsin",
    modifiers: ["Pishloq"],
  }]);
  assert.deepEqual(display.payments, [{
    key: "snapshot-payment-0",
    method: "Naqd pul",
    amount: "72000.00",
  }]);
});

test("explicit empty refund item snapshot does not fall back to live order items", () => {
  const display = receiptDisplaySnapshot(
    { documentType: "REFUND", items: [], payments: [{ method: "CASH", amount: "-5" }] },
    { items: [{ id: "live-item", productName: "Current product", quantity: "1", totalPrice: "5" }] },
  );
  assert.deepEqual(display.items, []);
  assert.equal(display.payments[0]?.amount, "-5");
});

test("legacy receipt detail falls back when snapshot arrays are absent", () => {
  const display = receiptDisplaySnapshot(
    { documentType: "RECEIPT" },
    {
      items: [{ id: "legacy-item", productName: "Legacy item", quantity: "1", totalPrice: "9" }],
      payments: [{ id: "legacy-payment", amount: "9", method: { code: "CASH", name: "Naqd" } }],
    },
  );
  assert.equal(display.items[0]?.name, "Legacy item");
  assert.equal(display.payments[0]?.method, "Naqd");
});
