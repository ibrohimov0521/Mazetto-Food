import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeEventCursor,
  encodeEventCursor,
} from "../src/modules/realtime/realtime.service";

test("realtime cursor round-trips timestamp and event id", () => {
  const createdAt = new Date("2026-09-20T06:00:00.000Z");
  const cursor = encodeEventCursor(createdAt, "event-42");

  assert.deepEqual(decodeEventCursor(cursor), {
    createdAt: createdAt.toISOString(),
    id: "event-42",
  });
});

test("realtime cursor rejects malformed input", () => {
  assert.throws(
    () => decodeEventCursor("not-a-cursor"),
    /Realtime cursor noto'g'ri/,
  );
});