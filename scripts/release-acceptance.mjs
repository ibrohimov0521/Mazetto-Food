#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const productionSmoke = process.argv.includes("--production-smoke");
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) {
  throw new Error("Run release acceptance through pnpm");
}
const stages = [
  ["Workspace verify", ["verify"]],
  ["Automated tests", ["test"]],
  ["Disposable order-to-cash-to-stock-to-print E2E", ["qa:isolated-order-e2e"]],
  ...(productionSmoke ? [["Read-only production smoke", ["release:smoke"]]] : []),
];

for (const [label, args] of stages) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [pnpmCli, ...args], {
    stdio: "inherit",
    // Windows PTY/TUI can keep Turbo alive after a successful build. Release
    // acceptance must behave like CI so the next gate can start reliably.
    env: {
      ...process.env,
      CI: process.env.CI || "1",
      TURBO_UI: "stream",
    },
  });
  if (result.status !== 0) {
    console.error(`\nRelease acceptance stopped at: ${label}`);
    process.exitCode = result.status ?? 1;
    break;
  }
}

if (!process.exitCode) {
  console.log("\nAutomated release acceptance passed.");
  if (!productionSmoke) {
    console.log("Production smoke was not requested; run with --production-smoke after deploy.");
  }
}
