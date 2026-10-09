import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeCashInput } from "../lib/cash-entry.mjs";

test("cash entry strips leading zeroes and non-numeric characters", () => {
  assert.equal(sanitizeCashInput("000125"), "125");
  assert.equal(sanitizeCashInput("12a.50"), "1250");
});

test("cash entry is capped at twelve digits", () => {
  assert.equal(sanitizeCashInput("1234567890123"), "123456789012");
});
