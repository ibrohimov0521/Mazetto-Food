import assert from "node:assert/strict";
import test from "node:test";
import { isOperationalPaymentMethod } from "../src/modules/payments/payments.service";

test("faqat integratsiyasi tayyor to'lov usuli operatsion hisoblanadi", () => {
  assert.equal(isOperationalPaymentMethod("CASH"), true);
  assert.equal(isOperationalPaymentMethod("cash"), true);
  assert.equal(isOperationalPaymentMethod("CARD"), false);
  assert.equal(isOperationalPaymentMethod("CLICK"), false);
  assert.equal(isOperationalPaymentMethod("PAYME"), false);
});
