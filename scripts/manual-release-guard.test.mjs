import assert from "node:assert/strict";
import test from "node:test";
import { validateManualRelease } from "./manual-release-guard.mjs";

const sha = "a".repeat(40);
const backupPath = "/backups/production.dump";

function input(overrides = {}) {
  return {
    sha,
    phase: "platform-web",
    backupPath,
    migrationsApplied: true,
    targetedRedeploy: false,
    since: "b".repeat(40),
    apps: "backend platform-web customer-web",
    migrations: "20261002180000_print_driver_submission_status",
    mainSha: sha,
    ...overrides,
  };
}

test("allows a changed app only after the migration confirmation", () => {
  assert.deepEqual(validateManualRelease(input()), {
    mode: "migration-release",
  });
});

test("allows the staff Telegram agent as a migration release phase", () => {
  assert.deepEqual(
    validateManualRelease(
      input({
        phase: "telegram-staff-bot",
        apps: "backend telegram-staff-bot",
      }),
    ),
    { mode: "migration-release" },
  );
});

test("allows an explicit same-SHA redeploy when nothing remains in the diff", () => {
  assert.deepEqual(
    validateManualRelease(
      input({
        since: sha,
        apps: "",
        migrations: "",
        backupPath: "",
        migrationsApplied: false,
        targetedRedeploy: true,
      }),
    ),
    { mode: "targeted-redeploy" },
  );
});

test("rejects same-SHA redeploy unless explicitly enabled", () => {
  assert.throws(
    () =>
      validateManualRelease(input({ since: sha, apps: "", migrations: "" })),
    /only for migration releases/,
  );
});

test("rejects targeted redeploy if main moved", () => {
  assert.throws(
    () => validateManualRelease(input({ mainSha: "c".repeat(40) })),
    /main moved/,
  );
});

test("rejects targeted redeploy while an app or migration diff remains", () => {
  assert.throws(
    () =>
      validateManualRelease(
        input({
          targetedRedeploy: true,
        }),
      ),
    /only when production already equals this SHA/,
  );
});

test("rejects deployment before migration confirmation", () => {
  assert.throws(
    () => validateManualRelease(input({ migrationsApplied: false })),
    /Apply and verify production migrations/,
  );
});

test("rejects missing production baseline and invalid phase inputs", () => {
  assert.throws(
    () => validateManualRelease(input({ since: "" })),
    /production tag is missing/,
  );
  assert.throws(
    () => validateManualRelease(input({ phase: "print-agent" })),
    /Unknown release phase/,
  );
});

test("rejects an invalid backup path and a non-main SHA", () => {
  assert.throws(
    () => validateManualRelease(input({ backupPath: "relative.dump" })),
    /absolute PostgreSQL dump path/,
  );
  assert.throws(
    () => validateManualRelease(input({ sha: "not-a-sha" })),
    /Full release SHA/,
  );
});
