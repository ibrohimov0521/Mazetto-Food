#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(new URL("../apps/backend/package.json", import.meta.url));
const { Client } = require("pg");
const adminUrl = new URL(
  process.env.MAZETTO_E2E_ADMIN_DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
);
assert.ok(
  ["127.0.0.1", "localhost", "::1"].includes(adminUrl.hostname),
  "Isolated E2E refuses non-local PostgreSQL hosts",
);
const databaseName = `mazetto_step8_release_${process.pid}_${Date.now()}`;
assert.match(databaseName, /^[a-z0-9_]+$/);
const databaseUrl = new URL(adminUrl);
databaseUrl.pathname = `/${databaseName}`;
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("Run this command through pnpm");

function run(args) {
  const result = spawnSync(process.execPath, [pnpmCli, ...args], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl.toString(),
      MAZETTO_E2E_ISOLATED_DB: "1",
    },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: pnpm ${args.join(" ")}`);
  }
}

const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  run(["--filter", "backend", "prisma:migrate:deploy"]);
  run(["--filter", "backend", "exec", "prisma", "db", "seed"]);
  run([
    "--filter",
    "backend",
    "exec",
    "tsx",
    "scripts/validate-customer-order-e2e-db.ts",
  ]);
  console.log("Disposable order-to-cash-to-stock-to-print E2E passed.");
} finally {
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [databaseName],
  );
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  await admin.end();
}
