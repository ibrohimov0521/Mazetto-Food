import assert from "node:assert/strict";
import test from "node:test";
import { refreshBeforeCursorCheckpoint } from "../lib/realtime-cursor-checkpoint.mjs";

test("cursor persistence waits until the subscribed view refresh finishes", async () => {
  let finishRefresh;
  let persisted = false;
  const refresh = new Promise((resolve) => {
    finishRefresh = resolve;
  });
  const checkpoint = refreshBeforeCursorCheckpoint(
    () => refresh,
    async () => {
      persisted = true;
    },
  );

  await Promise.resolve();
  assert.equal(persisted, false);
  finishRefresh(true);
  assert.equal(await checkpoint, true);
  assert.equal(persisted, true);
});

test("a deferred or failed refresh leaves the cursor unpersisted", async () => {
  let persisted = false;
  const persist = async () => {
    persisted = true;
  };

  assert.equal(
    await refreshBeforeCursorCheckpoint(async () => false, persist),
    false,
  );
  assert.equal(persisted, false);
  await assert.rejects(
    refreshBeforeCursorCheckpoint(
      async () => {
        throw new Error("refresh failed");
      },
      persist,
    ),
    /refresh failed/,
  );
  assert.equal(persisted, false);
});

test("a cancelled subscriber does not checkpoint after its refresh", async () => {
  let finishRefresh;
  let active = true;
  let persisted = false;
  const refresh = new Promise((resolve) => {
    finishRefresh = resolve;
  });
  const checkpoint = refreshBeforeCursorCheckpoint(
    () => refresh,
    async () => {
      persisted = true;
    },
    () => active,
  );

  await Promise.resolve();
  active = false;
  finishRefresh(true);
  assert.equal(await checkpoint, false);
  assert.equal(persisted, false);
});
