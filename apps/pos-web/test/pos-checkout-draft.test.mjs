import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPosCheckoutPayloadSignature,
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

test("modifier quantities round-trip and reject invalid values", () => {
  const modifierLine = {
    ...line,
    modifierQuantities: { "modifier-1": 3 },
  };
  const draft = {
    lines: [modifierLine],
    checkoutAttempt: null,
    orderType: "TAKEAWAY",
    payLater: false,
    tableId: "",
    paymentCode: "CASH",
    cashReceived: "",
  };
  assert.deepEqual(
    parsePosCheckoutDraft(serializePosCheckoutDraft(draft)),
    draft,
  );
  assert.equal(
    parsePosCheckoutDraft(
      JSON.stringify({
        version: 1,
        lines: [{ ...modifierLine, modifierQuantities: { "modifier-1": 0 } }],
      }),
    ),
    null,
  );
});
test("checkout signature includes modifier quantity and ignores modifier ordering", () => {
  const base = {
    orderType: "TAKEAWAY",
    deferPayment: false,
    tableId: null,
    paymentCode: "CASH",
    cashReceived: 20000,
    total: 17000,
    items: [
      {
        productId: "product-1",
        variantId: null,
        quantity: 1,
        modifiers: [
          { modifierId: "modifier-a", quantity: 2 },
          { modifierId: "modifier-b", quantity: 1 },
        ],
      },
    ],
  };
  const signature = buildPosCheckoutPayloadSignature(base);
  const reordered = structuredClone(base);
  reordered.items[0].modifiers.reverse();
  assert.equal(buildPosCheckoutPayloadSignature(reordered), signature);
  const changedQuantity = structuredClone(base);
  changedQuantity.items[0].modifiers[0].quantity = 3;
  assert.notEqual(buildPosCheckoutPayloadSignature(changedQuantity), signature);
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
  const restored = parsePosCheckoutDraft(
    JSON.stringify({
      version: 1,
      lines: [line],
      checkoutAttempt: { key: "old-key", payloadSignature: "old-signature" },
      orderType: "DINE_IN",
    }),
  );
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
