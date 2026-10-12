import assert from "node:assert/strict";
import test from "node:test";
import { getKitchenAlertTicketState } from "../lib/kitchen-alert-state.mjs";

test("initial snapshot alerts only new, unacknowledged kitchen tickets", () => {
  const state = getKitchenAlertTicketState(new Set(), [
    { id: "new-1", status: "NEW" },
    { id: "working", status: "COOKING" },
    { id: "new-2", status: "NEW" },
  ]);

  assert.deepEqual(state.arrivedIds, ["new-1", "new-2"]);
  assert.deepEqual(state.pendingIds, ["new-1", "new-2"]);
});

test("subsequent snapshots alert once and stop alerting after acknowledgement", () => {
  const previous = new Set(["old"]);
  const first = getKitchenAlertTicketState(previous, [
    { id: "old", status: "NEW" },
    { id: "fresh", status: "NEW" },
    { id: "done", status: "READY" },
  ]);
  assert.deepEqual(first.arrivedIds, ["fresh"]);

  const acknowledged = getKitchenAlertTicketState(
    first.activeIds,
    [
      { id: "old", status: "NEW" },
      { id: "fresh", status: "NEW" },
    ],
    new Set(["old", "fresh"]),
  );
  assert.deepEqual(acknowledged.arrivedIds, []);
  assert.deepEqual(acknowledged.pendingIds, []);
});

test("a resolved ticket leaves the pending set and can no longer sound", () => {
  const state = getKitchenAlertTicketState(
    new Set(["accepted", "new"]),
    [{ id: "accepted", status: "ACCEPTED" }, { id: "new", status: "NEW" }],
  );
  assert.deepEqual([...state.activeIds], ["new"]);
  assert.deepEqual(state.arrivedIds, []);
});
