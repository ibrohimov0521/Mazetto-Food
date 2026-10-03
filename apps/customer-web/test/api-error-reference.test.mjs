import assert from "node:assert/strict";
import test from "node:test";
import { customerServerErrorMessage } from "../lib/api-error-reference.mjs";

test("adds a safe backend request id to the customer-facing server error", () => {
  assert.equal(
    customerServerErrorMessage("req-123:abc"),
    "Serverda vaqtinchalik muammo bor. Bir ozdan keyin qayta urinib ko'ring. Murojaat kodi: req-123:abc.",
  );
});

test("uses a generic server error when no request id is available", () => {
  assert.equal(
    customerServerErrorMessage(undefined),
    "Serverda vaqtinchalik muammo bor. Bir ozdan keyin qayta urinib ko'ring.",
  );
});

test("does not expose malformed request id values", () => {
  assert.equal(
    customerServerErrorMessage("token=private"),
    "Serverda vaqtinchalik muammo bor. Bir ozdan keyin qayta urinib ko'ring.",
  );
});
