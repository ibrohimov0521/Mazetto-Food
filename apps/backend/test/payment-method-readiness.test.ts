import assert from "node:assert/strict";
import test from "node:test";
import { isOperationalPaymentMethod } from "../src/modules/payments/payments.service";

test("kassir faqat naqd to'lovni qabul qila oladi", () => {
  assert.equal(isOperationalPaymentMethod("CASH"), true);
  assert.equal(isOperationalPaymentMethod("cash"), true);
  assert.equal(isOperationalPaymentMethod("CARD"), false);
  assert.equal(isOperationalPaymentMethod("UZCARD"), false);
  assert.equal(isOperationalPaymentMethod("HUMO"), false);
  assert.equal(isOperationalPaymentMethod("CLICK"), false);
  assert.equal(isOperationalPaymentMethod("PAYME"), false);
  assert.equal(isOperationalPaymentMethod("ONLINE"), false);
  assert.equal(isOperationalPaymentMethod("UNKNOWN"), false);
});
