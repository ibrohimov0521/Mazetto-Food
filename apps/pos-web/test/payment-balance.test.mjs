import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOutstandingPaymentBalance,
  summarizePaymentPage,
} from "../lib/payment-balance.mjs";

test("cashier balance subtracts partial refunds before collection", () => {
  assert.deepEqual(
    calculateOutstandingPaymentBalance("74000", [
      {
        amount: "74000",
        status: "PARTIALLY_REFUNDED",
        refunds: [{ amount: "24000" }],
      },
    ]),
    { paid: 50000, outstanding: 24000 },
  );
});

test("cashier balance includes multiple tenders and their refunds", () => {
  assert.deepEqual(
    calculateOutstandingPaymentBalance("90000", [
      {
        amount: "50000",
        status: "SUCCESS",
        refunds: [{ amount: "10000" }],
      },
      { amount: "30000", status: "PAID", refunds: [] },
      { amount: "20000", status: "FAILED", refunds: [] },
      { amount: "10000", status: "REFUNDED", refunds: [{ amount: "10000" }] },
    ]),
    { paid: 70000, outstanding: 20000 },
  );
});

test("cashier balance fails closed when partial-refund details are missing", () => {
  assert.equal(
    calculateOutstandingPaymentBalance("74000", [
      { amount: "74000", status: "PARTIALLY_REFUNDED" },
    ]),
    null,
  );
});

test("cashier balance fails closed for invalid or excessive refund amounts", () => {
  assert.equal(
    calculateOutstandingPaymentBalance("74000", [
      {
        amount: "74000",
        status: "PARTIALLY_REFUNDED",
        refunds: [{ amount: "75000" }],
      },
    ]),
    null,
  );
  assert.equal(calculateOutstandingPaymentBalance("74.001", []), null);
});

test("payment page summary includes partial collections and lists refunds separately", () => {
  assert.deepEqual(
    summarizePaymentPage([
      {
        amount: "74000",
        status: "PARTIALLY_REFUNDED",
        methodCode: "CASH",
        refunds: [{ amount: "24000" }],
      },
      {
        amount: "30000",
        status: "SUCCESS",
        method: { code: "CARD" },
        refunds: [],
      },
      {
        amount: "10000",
        status: "REFUNDED",
        methodCode: "CASH",
        refunds: [{ amount: "10000" }],
      },
    ]),
    {
      total: 3,
      successful: 2,
      cash: 74000,
      cashless: 30000,
      refunds: 34000,
    },
  );
});
