import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ACTIVE_KITCHEN_TICKETS,
  trimKitchenQueue,
} from "../src/modules/kitchen/kitchen-queue-window";

test("kitchen queue reports when active tickets exceed the visible limit", () => {
  const atLimit = Array.from(
    { length: MAX_ACTIVE_KITCHEN_TICKETS },
    (_, i) => i,
  );
  const overLimit = [...atLimit, MAX_ACTIVE_KITCHEN_TICKETS];

  assert.equal(
    trimKitchenQueue(atLimit).items.length,
    MAX_ACTIVE_KITCHEN_TICKETS,
  );
  assert.equal(trimKitchenQueue(atLimit).hasMore, false);
  assert.equal(
    trimKitchenQueue(overLimit).items.length,
    MAX_ACTIVE_KITCHEN_TICKETS,
  );
  assert.equal(trimKitchenQueue(overLimit).hasMore, true);
  assert.equal(trimKitchenQueue(overLimit).limit, 250);
});
