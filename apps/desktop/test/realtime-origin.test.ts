import assert from "node:assert/strict";
import test from "node:test";
import { realtimeSocketOrigin } from "../src/realtime-origin.js";

test("desktop realtime transport uses only the configured API origin", () => {
  assert.equal(
    realtimeSocketOrigin("https://api.example.test/api/v1"),
    "https://api.example.test",
  );
  assert.equal(
    realtimeSocketOrigin("https://api.example.test/prefix/api/v1/"),
    "https://api.example.test",
  );
});

test("desktop realtime transport rejects non-web URLs and embedded credentials", () => {
  for (const url of [
    "file:///api/v1",
    "javascript:alert(1)",
    "https://user:password@api.example.test/api/v1",
    "https://api.example.test/api/v1?token=secret",
  ]) {
    assert.throws(() => realtimeSocketOrigin(url));
  }
});
