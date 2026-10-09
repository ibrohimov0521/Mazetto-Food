import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePosCheckoutDraft,
  serializePosCheckoutDraft,
} from "../lib/pos-checkout-draft.mjs";

const line = {
  key: "line-1",
  productId: "product-1",
  variantId: "variant-1",
  modifierIds: ["modifier-1"],
  quantity: 2,
};

test("checkout draft round-trips the exact retry key and tender context", () => {
  const draft = {
    lines: [line],
    checkoutAttempt: {
      key: "stable-key",
      payloadSignature: "payload-signature",
    },
    orderType: "DINE_IN",
    payLater: true,
    tableId: "table-3",
    paymentCode: "CASH",
    cashReceived: "50000",
  };
  assert.deepEqual(
    parsePosCheckoutDraft(serializePosCheckoutDraft(draft)),
    draft,
  );
});

test("legacy line-array drafts still restore with safe defaults", () => {
  assert.deepEqual(parsePosCheckoutDraft(JSON.stringify([line])), {
    lines: [line],
    checkoutAttempt: null,
    orderType: "TAKEAWAY",
    payLater: false,
    tableId: "",
    paymentCode: "CASH",
    cashReceived: "",
  });
});

test("older object drafts default to prepaid without changing their retry key", () => {
  const restored = parsePosCheckoutDraft(JSON.stringify({
    version: 1,
    lines: [line],
    checkoutAttempt: { key: "old-key", payloadSignature: "old-signature" },
    orderType: "DINE_IN",
  }));
  assert.equal(restored?.payLater, false);
  assert.equal(restored?.checkoutAttempt?.key, "old-key");
});

test("invalid or malformed drafts are rejected without throwing", () => {
  assert.equal(parsePosCheckoutDraft("{"), null);
  assert.equal(
    parsePosCheckoutDraft(
      JSON.stringify({ version: 1, lines: [{ ...line, quantity: 0 }] }),
    ),
    null,
  );
});
