import assert from "node:assert/strict";
import test from "node:test";
import {
  appendCashInput,
  removeCashDigit,
  sanitizeCashInput,
} from "../lib/cash-entry.mjs";

test("numeric keypad appends digits and the three-zero shortcut", () => {
  assert.equal(appendCashInput("", "5"), "5");
  assert.equal(appendCashInput("12", "000"), "12000");
  assert.equal(appendCashInput("", "000"), "0");
});

test("cash entry strips leading zeroes and ignores invalid keys", () => {
  assert.equal(sanitizeCashInput("000125"), "125");
  assert.equal(appendCashInput("12", "Enter"), "12");
  assert.equal(sanitizeCashInput("12a.50"), "1250");
});

test("cash entry is capped at twelve digits", () => {
  const max = "999999999999";
  assert.equal(appendCashInput(max, "1"), max);
  assert.equal(sanitizeCashInput("1234567890123"), "123456789012");
});

test("backspace removes one digit and empties a one-digit amount", () => {
  assert.equal(removeCashDigit("12000"), "1200");
  assert.equal(removeCashDigit("7"), "");
});
