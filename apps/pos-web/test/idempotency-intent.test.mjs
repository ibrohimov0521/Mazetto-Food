import assert from "node:assert/strict";
import test from "node:test";
import { getIdempotencyIntent } from "../lib/idempotency-intent.mjs";

test("a retry with the same request fingerprint reuses its key", () => {
  const first = getIdempotencyIntent(null, "request-a", "cash-transfer");
  const retry = getIdempotencyIntent(first, "request-a", "cash-transfer");

  assert.equal(retry, first);
});

test("changed request content receives a new scoped key", () => {
  const first = getIdempotencyIntent(null, "amount-100", "refund:payment-a");
  const changed = getIdempotencyIntent(
    first,
    "amount-200",
    "refund:payment-a",
  );

  assert.notEqual(changed.key, first.key);
  assert.equal(changed.fingerprint, "amount-200");
  assert.match(changed.key, /^refund:payment-a:/);
});
