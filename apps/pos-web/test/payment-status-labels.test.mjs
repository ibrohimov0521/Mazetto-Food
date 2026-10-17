import assert from "node:assert/strict";
import test from "node:test";
import { paymentStatusLabels } from "../lib/order-display.ts";

test("payment status labels distinguish successful from paid", () => {
  assert.equal(paymentStatusLabels.SUCCESS, "Muvaffaqiyatli");
  assert.equal(paymentStatusLabels.PAID, "To'langan");
  assert.equal(
    new Set(Object.values(paymentStatusLabels)).size,
    Object.keys(paymentStatusLabels).length,
  );
});
