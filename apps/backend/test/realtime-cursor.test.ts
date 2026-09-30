import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeBranchRevisionCursor,
  decodeEventCursor,
  encodeBranchRevisionCursor,
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
test("branch revision cursors round-trip independently per branch", () => {
  const cursor = encodeBranchRevisionCursor(
    { "branch-a": 91n, "branch-b": "12" },
    "branch-b",
  );

  assert.deepEqual(decodeBranchRevisionCursor(cursor), {
    version: 2,
    branches: { "branch-a": "91", "branch-b": "12" },
    lastBranchId: "branch-b",
  });
  assert.equal(
    decodeBranchRevisionCursor(encodeEventCursor(new Date(), "event-1")),
    null,
  );
});

test("branch revision cursor rejects negative revisions", () => {
  const malformed = Buffer.from(
    JSON.stringify({ version: 2, branches: { "branch-a": "-1" } }),
  ).toString("base64url");

  assert.throws(
    () => decodeBranchRevisionCursor(malformed),
    /Realtime cursor noto'g'ri/,
  );
});
