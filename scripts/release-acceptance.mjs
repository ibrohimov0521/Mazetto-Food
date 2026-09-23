#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const productionSmoke = process.argv.includes("--production-smoke");
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) {
  throw new Error("Run release acceptance through pnpm");
}

const pnpm = (...args) => [pnpmCli, ...args];

const stages = [
  ["Backend Prisma client", pnpm("--filter", "backend", "prisma:generate")],
  ["Backend typecheck", pnpm("--filter", "backend", "typecheck")],
  ["Backend lint", pnpm("--filter", "backend", "lint")],
  ["Backend build", pnpm("--filter", "backend", "build")],
  ["POS web typecheck", pnpm("--filter", "pos-web", "typecheck")],
  ["POS web lint", pnpm("--filter", "pos-web", "lint")],
  ["POS web build", pnpm("--filter", "pos-web", "build")],
  ["Customer web typecheck", pnpm("--filter", "customer-web", "typecheck")],
  ["Customer web lint", pnpm("--filter", "customer-web", "lint")],
  ["Customer web build", pnpm("--filter", "customer-web", "build")],
  ["Telegram bot typecheck", pnpm("--filter", "telegram-bot", "typecheck")],
  ["Telegram bot lint", pnpm("--filter", "telegram-bot", "lint")],
  ["Telegram bot build", pnpm("--filter", "telegram-bot", "build")],
  ["Print agent typecheck", pnpm("--filter", "print-agent", "typecheck")],
  ["Print agent lint", pnpm("--filter", "print-agent", "lint")],
  ["Print agent build", pnpm("--filter", "print-agent", "build")],
  ["Desktop typecheck", pnpm("--filter", "mazetto-desktop", "typecheck")],
  ["Desktop lint", pnpm("--filter", "mazetto-desktop", "lint")],
  ["Desktop build", pnpm("--filter", "mazetto-desktop", "build")],
  ["Backend tests", pnpm("--filter", "backend", "test")],
  ["Desktop tests", pnpm("--filter", "mazetto-desktop", "test")],
  ["Static validators", pnpm("validate")],
  ["Media asset validation", pnpm("media:validate")],
  ["Disposable order-to-cash-to-stock-to-print E2E", ["qa:isolated-order-e2e"]],
  ...(productionSmoke ? [["Read-only production smoke", ["release:smoke"]]] : []),
];

for (const [label, args] of stages) {
  console.log(`\n=== ${label} ===`);
  const commandArgs = args[0] === pnpmCli ? args : [pnpmCli, ...args];
  const result = spawnSync(process.execPath, commandArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      CI: process.env.CI || "1",
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://ci:ci@localhost:5432/ci",
      TURBO_UI: "stream",
      TURBO_DAEMON: "false",
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
