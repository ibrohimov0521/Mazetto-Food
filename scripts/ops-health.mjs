#!/usr/bin/env node
import { execFileSync } from "node:child_process";

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

for (const [name, url] of httpChecks) {
  let status = "javob yo'q";

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    status = String(response.status);
  } catch {
    // javobsiz — yuqoridagi default qoladi
  }

  console.log(`${name.padEnd(13)} ${status}`);
}

const containerChecks = [
  ["postgres", ["exec", process.env.MAZETTO_PG_CONTAINER ?? "mazetto-postgres", "pg_isready", "-U", process.env.POSTGRES_USER ?? "mazetto"]],
  ["redis", ["exec", "mazetto-redis", "redis-cli", "PING"]],
];

for (const [name, args] of containerChecks) {
  try {
    const out = execFileSync("docker", args, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    console.log(`${name.padEnd(13)} ${out.split("\n").pop()}`);
  } catch {
    console.log(`${name.padEnd(13)} javob yo'q`);
  }
}
