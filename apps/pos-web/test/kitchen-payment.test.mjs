import assert from "node:assert/strict";
import test from "node:test";
import { pickupOutstanding } from "../components/kitchen/kitchen-payment.mjs";

test("paid cashier status clears pickup balance", () =>
  assert.equal(
    pickupOutstanding({
      type: "TAKEAWAY",
      total: "85000",
      paymentStatus: "PAID",
    }),
    0,
  ));
test("unpaid pickup keeps its full cashier balance", () =>
  assert.equal(
    pickupOutstanding({
      type: "TAKEAWAY",
      total: "85000",
      paymentStatus: "PENDING",
    }),
    85000,
  ));
test("partial payment shows only remaining pickup balance", () =>
  assert.equal(
    pickupOutstanding({
      type: "TAKEAWAY",
      total: "85000",
      paymentStatus: "PENDING",
      payments: [{ amount: "70000", status: "SUCCESS" }],
    }),
    15000,
  ));
test("non-pickup orders have no cashier balance in kitchen", () =>
  assert.equal(
    pickupOutstanding({
      type: "DINE_IN",
      total: "85000",
      paymentStatus: "PENDING",
    }),
    0,
  ));
