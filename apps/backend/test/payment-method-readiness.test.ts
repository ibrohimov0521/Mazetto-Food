import assert from "node:assert/strict";
import test from "node:test";
import { isOperationalPaymentMethod } from "../src/modules/payments/payments.service";

test("kassir qo'lda qabul qilishi mumkin bo'lgan usullar kod reestrida bor", () => {
  assert.equal(isOperationalPaymentMethod("CASH"), true);
  assert.equal(isOperationalPaymentMethod("cash"), true);
  assert.equal(isOperationalPaymentMethod("CARD"), true);
  assert.equal(isOperationalPaymentMethod("UZCARD"), true);
  assert.equal(isOperationalPaymentMethod("HUMO"), true);
  assert.equal(isOperationalPaymentMethod("CLICK"), true);
  assert.equal(isOperationalPaymentMethod("PAYME"), true);
  assert.equal(isOperationalPaymentMethod("ONLINE"), true);
  assert.equal(isOperationalPaymentMethod("UNKNOWN"), false);
});
