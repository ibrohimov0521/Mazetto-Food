import assert from "node:assert/strict";
import test from "node:test";
import { startRetryLoop } from "../src/retry-loop.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("retry loop recovers after an initial transient failure", async () => {
  let attempts = 0;
  let recovered = false;
  const errors: unknown[] = [];
  const stop = startRetryLoop(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary network failure");
      recovered = true;
    },
    10,
    (error) => errors.push(error),
  );

  try {
    for (let i = 0; i < 20 && !recovered; i += 1) await delay(5);
    assert.equal(recovered, true);
    assert.equal(attempts, 2);
    assert.equal(errors.length, 1);
  } finally {
    stop();
  }
});

test("retry loop never overlaps a slow check", async () => {
  let active = 0;
  let maxActive = 0;
  let runs = 0;
  const errors: unknown[] = [];
  const stop = startRetryLoop(
    async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(25);
      active -= 1;
      runs += 1;
    },
    5,
    (error) => errors.push(error),
  );

  await delay(70);
  stop();
  assert.equal(maxActive, 1);
  assert.ok(runs >= 2);
  assert.deepEqual(errors, []);
});
