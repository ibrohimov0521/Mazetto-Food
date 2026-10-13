#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(new URL("../apps/backend/package.json", import.meta.url));
const { Client } = require("pg");
const archiveArg = process.argv.find((argument) => argument.startsWith("--archive="));
if (!archiveArg) {
  console.error("Usage: pnpm db:rehearse-restore -- --archive=C:\\path\\backup.dump");
  process.exit(2);
}
const archive = resolve(archiveArg.slice("--archive=".length));
assert.ok(existsSync(archive), `Backup archive not found: ${archive}`);

const adminUrl = new URL(
  process.env.MAZETTO_REHEARSAL_ADMIN_DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
);
assert.ok(
  ["127.0.0.1", "localhost", "::1"].includes(adminUrl.hostname),
  "Restore rehearsal refuses non-local PostgreSQL hosts",
);
const pgToolContainer = process.env.MAZETTO_PG_TOOL_CONTAINER?.trim();
if (pgToolContainer) {
  assert.match(pgToolContainer, /^mazetto-audit-[a-z0-9-]+$/, "Restore tools must run in a dedicated audit container");
  const portBindings = JSON.parse(
    execFileSync(
      "docker",
      ["inspect", "--format", "{{json .NetworkSettings.Ports}}", pgToolContainer],
      { encoding: "utf8" },
    ),
  );
  const localBindings = Object.values(portBindings)
    .flatMap((bindings) => bindings ?? [])
    .filter((binding) => ["127.0.0.1", "::1"].includes(binding.HostIp));
  assert.ok(
    localBindings.some((binding) => binding.HostPort === (adminUrl.port || "5432")),
    "Restore tool container must expose the loopback PostgreSQL port used by the rehearsal URL",
  );
}
const suffix = `${process.pid}_${Date.now()}`;
const migrationDatabase = `mazetto_restore_migrate_${suffix}`;
const rollbackDatabase = `mazetto_restore_rollback_${suffix}`;
for (const name of [migrationDatabase, rollbackDatabase]) assert.match(name, /^[a-z0-9_]+$/);

const pgBin = process.env.MAZETTO_PG_BIN?.trim();
const candidates = (tool) => [
  pgBin ? resolve(pgBin, `${tool}.exe`) : "",
  `C:\\Program Files\\PostgreSQL\\18\\bin\\${tool}.exe`,
  `C:\\Program Files\\PostgreSQL\\16\\bin\\${tool}.exe`,
  tool,
].filter(Boolean);
const executable = (tool) => candidates(tool).find((candidate) => candidate === tool || existsSync(candidate));
const psql = executable("psql");
const pgRestore = executable("pg_restore");
assert.ok(pgToolContainer || psql, "psql was not found; set MAZETTO_PG_BIN or MAZETTO_PG_TOOL_CONTAINER");

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("Run this command through pnpm");
const evidenceDir = resolve(".release-evidence");
mkdirSync(evidenceDir, { recursive: true });

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function pgEnvironment(database) {
  return {
    ...process.env,
    PGHOST: adminUrl.hostname,
    PGPORT: adminUrl.port || "5432",
    PGUSER: decodeURIComponent(adminUrl.username),
    PGPASSWORD: decodeURIComponent(adminUrl.password),
    PGDATABASE: database,
  };
}

async function runRestore(database) {
  const lower = archive.toLowerCase();
  const custom = !lower.endsWith(".sql") && !lower.endsWith(".sql.gz");
  const tool = custom ? pgRestore : psql;
  assert.ok(tool, `${custom ? "pg_restore" : "psql"} was not found; set MAZETTO_PG_BIN`);
  const args = custom
    ? ["--exit-on-error", "--no-owner", "--no-privileges", "-d", database]
    : ["--set", "ON_ERROR_STOP=on", "-d", database];
  const command = pgToolContainer ? "docker" : tool;
  const commandArgs = pgToolContainer
    ? ["exec", "-i", pgToolContainer, tool, "-h", "/var/run/postgresql", "-U", decodeURIComponent(adminUrl.username), ...args]
    : args;
  const child = spawn(command, commandArgs, {
    env: pgToolContainer ? process.env : pgEnvironment(database),
    stdio: ["pipe", "inherit", "inherit"],
  });
  const input = createReadStream(archive);
  const source = lower.endsWith(".gz") ? input.pipe(createGunzip()) : input;
  const [close] = await Promise.all([once(child, "close"), pipeline(source, child.stdin)]);
  if (close[0] !== 0) throw new Error(`Restore failed for ${database}`);
}

function runMigrations(database) {
  const target = new URL(adminUrl);
  target.pathname = `/${database}`;
  return new Promise((resolvePromise, reject) => {
    const pnpmIsScript = /\.(?:cjs|mjs|js)$/i.test(pnpmCli);
    const pnpmCommand = pnpmIsScript ? process.execPath : pnpmCli;
    const pnpmArguments = [
      ...(pnpmIsScript ? [pnpmCli] : []),
      "--filter",
      "backend",
      "prisma:migrate:deploy",
    ];
    const child = spawn(
      pnpmCommand,
      pnpmArguments,
      {
        cwd: new URL("..", import.meta.url),
        env: { ...process.env, DATABASE_URL: target.toString() },
        stdio: "inherit",
        shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(pnpmCli),
      },
    );
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolvePromise() : reject(new Error("Migration deploy failed")));
  });
}

async function counts(database) {
  const clientUrl = new URL(adminUrl);
  clientUrl.pathname = `/${database}`;
  const client = new Client({ connectionString: clientUrl.toString() });
  await client.connect();
  try {
    const tables = ["branches", "employees", "orders", "payments", "receipts"];
    const result = {};
    for (const table of tables) {
      const exists = await client.query("SELECT to_regclass($1) AS name", [`public.${table}`]);
      result[table] = exists.rows[0]?.name
        ? Number((await client.query(`SELECT count(*)::bigint AS count FROM "${table}"`)).rows[0].count)
        : null;
    }
    const productRoutes = await client.query(
      `SELECT "printerRouting"::text AS route, count(*)::bigint AS count
       FROM "products"
       GROUP BY "printerRouting"
       ORDER BY "printerRouting"`
    );
    result.productPrinterRouting = Object.fromEntries(
      productRoutes.rows.map(({ route, count }) => [route, Number(count)]),
    );
    return result;
  } finally {
    await client.end();
  }
}

const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();
const evidence = {
  version: 1,
  archive: basename(archive),
  archiveBytes: statSync(archive).size,
  archiveSha256: await sha256(archive),
  startedAt: new Date().toISOString(),
  preMigrationCounts: null,
  migratedCounts: null,
  rollbackCounts: null,
  productPrinterRoutingPreserved: false,
  migrationsIdempotent: false,
  rollbackRestoreMatches: false,
};
try {
  await admin.query(`CREATE DATABASE "${migrationDatabase}"`);
  await runRestore(migrationDatabase);
  evidence.preMigrationCounts = await counts(migrationDatabase);
  await runMigrations(migrationDatabase);
  await runMigrations(migrationDatabase);
  evidence.migrationsIdempotent = true;
  evidence.migratedCounts = await counts(migrationDatabase);
  evidence.productPrinterRoutingPreserved =
    JSON.stringify(evidence.preMigrationCounts.productPrinterRouting) ===
    JSON.stringify(evidence.migratedCounts.productPrinterRouting);
  assert.ok(
    evidence.productPrinterRoutingPreserved,
    "Migrations must preserve existing product printer routing choices",
  );

  await admin.query(`CREATE DATABASE "${rollbackDatabase}"`);
  await runRestore(rollbackDatabase);
  evidence.rollbackCounts = await counts(rollbackDatabase);
  evidence.rollbackRestoreMatches =
    JSON.stringify(evidence.rollbackCounts) === JSON.stringify(evidence.preMigrationCounts);
  assert.ok(evidence.rollbackRestoreMatches, "Rollback restore row counts differ from initial restore");
  evidence.finishedAt = new Date().toISOString();
  writeFileSync(
    resolve(evidenceDir, "database-restore-rehearsal.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log("Database restore, double-migration and rollback-restore rehearsal passed.");
} finally {
  for (const database of [migrationDatabase, rollbackDatabase]) {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [database],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
  }
  await admin.end();
}
