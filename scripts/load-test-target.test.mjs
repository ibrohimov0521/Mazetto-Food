import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./load-test.mjs", import.meta.url));

test("load test requires explicit targets before sending requests", () => {
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: { ...process.env, LOAD_TEST_BASE_URL: "", LOAD_TEST_API_URL: "" },
  });

  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Set both LOAD_TEST_BASE_URL and LOAD_TEST_API_URL/);
  assert.equal(result.stdout, "");
});

test("load test keeps rejecting non-local hosts", () => {
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      LOAD_TEST_BASE_URL: "https://example.com",
      LOAD_TEST_API_URL: "http://127.0.0.1:4000/api/v1",
    },
  });

  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Load tests are restricted to localhost/);
  assert.equal(result.stdout, "");
});
