import assert from "node:assert/strict";
import test from "node:test";
import { withApiErrorReference } from "../lib/api-error-reference.mjs";

test("server errors include their support request ID", () => {
  assert.equal(
    withApiErrorReference("Internal server error", 500, "trace-123"),
    "Internal server error (Murojaat kodi: trace-123)",
  );
});

test("client errors do not expose internal support references", () => {
  assert.equal(
    withApiErrorReference("Ruxsat yo'q", 403, "trace-123"),
    "Ruxsat yo'q",
  );
});

test("a missing server reference leaves the message readable", () => {
  assert.equal(
    withApiErrorReference("Internal server error", 500),
    "Internal server error",
  );
});

