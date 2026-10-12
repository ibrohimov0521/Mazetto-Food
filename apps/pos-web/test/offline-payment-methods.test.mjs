import assert from "node:assert/strict";
import test from "node:test";
import {
  canSubmitPosCheckout,
  filterOfflinePaymentMethods,
  isOfflineCatalogSnapshot,
} from "../lib/offline-payment-methods.mjs";

const methods = [
  { code: "CASH", name: "Naqd" },
  { code: "CLICK", name: "Click" },
  { code: "PAYME", name: "Payme" },
];

test("offline checkout only exposes cash from a cached settings snapshot", () => {
  assert.deepEqual(filterOfflinePaymentMethods(methods, true), [methods[0]]);
});

test("online checkout keeps every enabled cashier payment method", () => {
  assert.deepEqual(filterOfflinePaymentMethods(methods, false), methods);
});

test("offline checkout exposes no payment method when cash is disabled", () => {
  assert.deepEqual(filterOfflinePaymentMethods(methods.slice(1), true), []);
});

test("Desktop cached catalog is recognized as offline even when it returns HTTP 200", () => {
  assert.equal(isOfflineCatalogSnapshot(false, true), true);
});

test("live catalog and browser bootstrap fallback retain their own freshness state", () => {
  assert.equal(isOfflineCatalogSnapshot(false, false), false);
  assert.equal(isOfflineCatalogSnapshot(true, false), true);
});

test("checkout stays disabled until a trusted catalog snapshot is available", () => {
  assert.equal(
    canSubmitPosCheckout({
      catalogReady: false,
      hasItems: true,
      deferredPayment: false,
      paymentMethodCount: 1,
      isCashPayment: true,
      validCash: true,
    }),
    false,
  );
});

test("deferred dine-in orders need a catalog but do not require payment methods", () => {
  const input = {
    catalogReady: true,
    hasItems: true,
    deferredPayment: true,
    paymentMethodCount: 0,
    isCashPayment: true,
    validCash: false,
  };
  assert.equal(canSubmitPosCheckout(input), true);
  assert.equal(canSubmitPosCheckout({ ...input, catalogReady: false }), false);
});

test("prepaid checkout requires an enabled method and a valid cash amount", () => {
  const input = {
    catalogReady: true,
    hasItems: true,
    deferredPayment: false,
    paymentMethodCount: 1,
    isCashPayment: true,
    validCash: false,
  };
  assert.equal(canSubmitPosCheckout(input), false);
  assert.equal(canSubmitPosCheckout({ ...input, validCash: true }), true);
  assert.equal(
    canSubmitPosCheckout({ ...input, paymentMethodCount: 0 }),
    false,
  );
});
