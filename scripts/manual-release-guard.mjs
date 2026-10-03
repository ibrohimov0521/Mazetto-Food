import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE_PHASES = new Set([
  "backend",
  "customer-web",
  "pos-web",
  "platform-web",
  "telegram-bot",
  "media",
]);

export function validateManualRelease({
  sha,
  phase,
  backupPath,
  migrationsApplied,
  targetedRedeploy,
  since,
  apps,
  migrations,
  mainSha,
}) {
  if (!/^[0-9a-f]{40}$/.test(sha ?? "")) {
    throw new Error("Full release SHA required");
  }
  if (!RELEASE_PHASES.has(phase)) {
    throw new Error(`Unknown release phase: ${phase || "(empty)"}`);
  }
  if (mainSha !== sha) {
    throw new Error(
      "main moved or does not point to the release SHA; release stopped",
    );
  }
  if (!since) {
    throw new Error(
      "production tag is missing; establish a verified baseline first",
    );
  }

  const changedApps = String(apps ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const pendingMigrations = String(migrations ?? "").trim();

  if (targetedRedeploy === true || targetedRedeploy === "true") {
    if (since !== sha || changedApps.length > 0 || pendingMigrations) {
      throw new Error(
        "Targeted redeploy is allowed only when production already equals this SHA and no app or migration changes remain",
      );
    }
    return { mode: "targeted-redeploy" };
  }

  if (!/^\/.+\.dump$/.test(backupPath ?? "")) {
    throw new Error("Verified absolute PostgreSQL dump path required");
  }
  if (migrationsApplied !== true && migrationsApplied !== "true") {
    throw new Error("Apply and verify production migrations before deployment");
  }

  if (pendingMigrations && changedApps.includes(phase)) {
    return { mode: "migration-release" };
  }

  if (!pendingMigrations) {
    throw new Error("This workflow is only for migration releases");
  }
  throw new Error(`No ${phase} change in the release gate`);
}

function runFromEnvironment() {
  try {
    const { mode } = validateManualRelease({
      sha: process.env.SHA,
      phase: process.env.PHASE,
      backupPath: process.env.BACKUP_PATH,
      migrationsApplied: process.env.MIGRATIONS_APPLIED,
      targetedRedeploy: process.env.TARGETED_REDEPLOY,
      since: process.env.SINCE,
      apps: process.env.APPS,
      migrations: process.env.MIGRATIONS,
      mainSha: process.env.MAIN_SHA,
    });

    appendFileSync(process.env.GITHUB_OUTPUT, `mode=${mode}\n`);
    const migrationList = process.env.MIGRATIONS || "none";
    const backupSummary =
      mode === "targeted-redeploy"
        ? "Not required for targeted redeploy"
        : process.env.BACKUP_PATH;
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Manual release ${process.env.SHA}\n\n- Phase: ${process.env.PHASE}\n- Mode: ${mode}\n- Backup path supplied by operator: ${backupSummary}\n- Pending migrations in gate: ${migrationList}\n`,
    );
    console.log(`Release phase approved: ${mode}`);
    if (mode === "migration-release") {
      console.log(
        "The workflow records the backup path but cannot independently verify the remote archive.",
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runFromEnvironment();
}
