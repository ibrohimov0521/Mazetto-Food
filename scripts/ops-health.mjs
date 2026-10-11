#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { isDockerHealthOutputHealthy, parseDockerContainerRows, resolveDockerHealthTarget } from "./docker-health-target.mjs";

/*
 * Lokal xizmatlar holati (7-bosqich Q3.3).
 *
 * Reliz checklist'ining 9-bosqichi ("public route health") lokal ekvivalenti.
 * Har seans boshida "nima ishlayapti?" savoliga bir buyruq bilan javob beradi.
 */

const httpChecks = [
  ["backend", "http://localhost:4000/api/v1/health"],
  ["pos-web", "http://localhost:3001/login"],
  ["customer-web", "http://localhost:3000/"],
];

let failedChecks = 0;
for (const [name, url] of httpChecks) {
  let status = "javob yo'q";

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    status = String(response.status);
  } catch {
    // javobsiz — yuqoridagi default qoladi
  }

  console.log(`${name.padEnd(13)} ${status}`);
  if (status !== "200") failedChecks += 1;
}

let runningContainers = [];
try {
  runningContainers = parseDockerContainerRows(
    execFileSync(
      "docker",
      ["ps", "--filter", "status=running", "--format", "{{.ID}}|{{.Image}}|{{.Names}}"],
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString(),
  );
} catch {
  // Direct container overrides and legacy names remain available below.
}

const containerChecks = [
  {
    name: "postgres",
    kind: "postgres",
    override: process.env.MAZETTO_PG_CONTAINER,
    args: ["pg_isready", "-U", process.env.POSTGRES_USER ?? "mazetto"],
  },
  {
    name: "redis",
    kind: "redis",
    override: process.env.MAZETTO_REDIS_CONTAINER,
    args: ["redis-cli", "PING"],
  },
];

for (const check of containerChecks) {
  const target = resolveDockerHealthTarget(
    check.kind,
    runningContainers,
    check.override,
  );
  if (target.error) {
    console.log(`${check.name.padEnd(13)} ${target.error}`);
    failedChecks += 1;
    continue;
  }

  try {
    const out = execFileSync(
      "docker",
      ["exec", target.container, ...check.args],
      { stdio: ["ignore", "pipe", "ignore"] },
    )
      .toString()
      .trim();
    const result = out.split("\n").pop() ?? "";
    console.log(`${check.name.padEnd(13)} ${result}`);
    if (!isDockerHealthOutputHealthy(check.kind, result)) {
      failedChecks += 1;
    }
  } catch {
    console.log(`${check.name.padEnd(13)} javob yo'q (${target.container})`);
    failedChecks += 1;
  }
}

if (failedChecks > 0) process.exitCode = 1;
