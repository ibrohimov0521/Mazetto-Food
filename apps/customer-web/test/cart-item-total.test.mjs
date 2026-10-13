import assert from "node:assert/strict";
import test from "node:test";
import { cartItemTotal } from "../lib/cart-item-total.mjs";

test("cart line total includes modifier quantities and product quantity", () => {
  assert.equal(
    cartItemTotal({
      unitPrice: "10000",
      quantity: 2,
      modifiers: [{ price: "1500", quantity: 3 }, { price: "500" }],
    }),
    30000,
  );
});

test("legacy cart modifiers default to one unit", () => {
  assert.equal(
    cartItemTotal({
      unitPrice: 12000,
      quantity: 1,
      modifiers: [{ price: 1000 }],
    }),
    13000,
  );
});
