import assert from "node:assert/strict";
import test from "node:test";
import { paymentStatusLabel } from "../lib/payment-status-label.mjs";

test("partially refunded payment is labeled in Uzbek and Russian", () => {
  assert.equal(paymentStatusLabel("PARTIALLY_REFUNDED"), "Qisman qaytarilgan");
  assert.equal(
    paymentStatusLabel("PARTIALLY_REFUNDED", "ru"),
    "Частичный возврат",
  );
});

test("unknown payment statuses retain a readable fallback", () => {
  assert.equal(paymentStatusLabel("UNKNOWN"), "Holat aniqlanmadi");
  assert.equal(paymentStatusLabel("UNKNOWN", "ru"), "Статус не определён");
});
