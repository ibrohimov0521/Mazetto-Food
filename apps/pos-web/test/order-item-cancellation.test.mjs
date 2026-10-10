import assert from "node:assert/strict";
import test from "node:test";
import { orderItemCancellationNeedsRefundPermission } from "../lib/order-item-cancellation.mjs";

test("unpaid or still-underpaid item cancellations do not need refund permission", () => {
  assert.equal(
    orderItemCancellationNeedsRefundPermission({
      orderTotal: "100000.00",
      itemTotal: "30000.00",
      payments: [],
    }),
    false,
  );
  assert.equal(
    orderItemCancellationNeedsRefundPermission({
      orderTotal: "100000.00",
      itemTotal: "30000.00",
      payments: [{ amount: "50000.00", status: "PAID" }],
    }),
    false,
  );
});

test("an overpaid remainder requires refund permission", () => {
  assert.equal(
    orderItemCancellationNeedsRefundPermission({
      orderTotal: "100000.00",
      itemTotal: "30000.00",
      payments: [{ amount: "100000.00", status: "SUCCESS" }],
    }),
    true,
  );
});

test("existing refunds reduce the tender amount before permission is checked", () => {
  assert.equal(
    orderItemCancellationNeedsRefundPermission({
      orderTotal: "100000.00",
      itemTotal: "30000.00",
      payments: [
        {
          amount: "100000.00",
          status: "PARTIALLY_REFUNDED",
          refunds: [{ amount: "70000.00" }],
        },
      ],
    }),
    false,
  );
});

test("unknown monetary values fail closed", () => {
  assert.equal(
    orderItemCancellationNeedsRefundPermission({
      orderTotal: "unknown",
      itemTotal: "30000.00",
      payments: [],
    }),
    true,
  );
});
