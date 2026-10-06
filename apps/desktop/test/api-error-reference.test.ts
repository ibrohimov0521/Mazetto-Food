import assert from "node:assert/strict";
import test from "node:test";
import { formatDesktopApiError } from "../src/api-error-reference.js";

test("includes a backend request ID for server errors", () => {
  assert.equal(
    formatDesktopApiError(
      { message: "Internal server error", requestId: "trace-123" },
      500,
      "Login amalga oshmadi",
    ),
    "Internal server error (Murojaat kodi: trace-123)",
  );
});

test("keeps authentication errors unchanged", () => {
  assert.equal(
    formatDesktopApiError({ message: "Invalid credentials" }, 401, "Failed"),
    "Invalid credentials",
  );
});

test("uses a fallback when the API error has no message", () => {
  assert.equal(formatDesktopApiError(undefined, 502, "API unavailable"), "API unavailable");
});
