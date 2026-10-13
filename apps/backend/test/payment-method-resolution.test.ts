import assert from "node:assert/strict";
import test from "node:test";
import { resolveEffectiveBranchPaymentMethods } from "../src/modules/payments/payment-method-resolution";

const method = (
  id: string,
  branchId: string | null,
  code: string,
  isActive = true,
) => ({ id, branchId, code, isActive });

test("branch payment method overrides global regardless of query order", () => {
  const effective = resolveEffectiveBranchPaymentMethods(
    [
      method("global-card", null, "CARD"),
      method("branch-card", "branch-a", "CARD"),
      method("global-cash", null, "CASH"),
    ],
    "branch-a",
  );

  assert.deepEqual(
    effective.map(({ id }) => id),
    ["branch-card", "global-cash"],
  );
});

test("inactive branch payment method suppresses the global method", () => {
  const effective = resolveEffectiveBranchPaymentMethods(
    [
      method("global-card", null, "CARD"),
      method("branch-card", "branch-a", "CARD", false),
    ],
    "branch-a",
  );

  assert.deepEqual(effective, []);
});

test("global payment methods remain available when no branch override exists", () => {
  const effective = resolveEffectiveBranchPaymentMethods(
    [method("global-cash", null, "CASH")],
    "branch-a",
  );

  assert.deepEqual(effective.map(({ id }) => id), ["global-cash"]);
});
