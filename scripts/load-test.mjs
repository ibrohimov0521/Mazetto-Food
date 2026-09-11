import { performance } from "node:perf_hooks";

const baseUrl = stripTrailingSlash(process.env.LOAD_TEST_BASE_URL ?? "https://mazettofood.uz");
const apiUrl = stripTrailingSlash(process.env.LOAD_TEST_API_URL ?? "https://api.mazettofood.uz/api/v1");
const levels = (process.env.LOAD_TEST_LEVELS ?? "10,25,50,100")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);
const requestsPerUser = Number(process.env.LOAD_TEST_REQUESTS_PER_USER ?? 6);
const timeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS ?? 10_000);

const scenario = [
  { name: "web home", url: `${baseUrl}/` },
  { name: "web menu", url: `${baseUrl}/menu` },
  { name: "api health", url: `${apiUrl}/health` },
  { name: "api branches", url: `${apiUrl}/customer/branches` },
  { name: "api categories", url: `${apiUrl}/customer/menu/categories` },
  { name: "api products", url: `${apiUrl}/customer/menu/products` },
];

if (levels.length === 0) {
  throw new Error("LOAD_TEST_LEVELS must contain at least one positive integer");
}

console.log(`Mazetto read-only load test`);
console.log(`Base URL: ${baseUrl}`);
console.log(`API URL: ${apiUrl}`);
console.log(`Levels: ${levels.join(", ")}`);
console.log(`Requests per user: ${requestsPerUser}`);
console.log("");

for (const users of levels) {
  const result = await runLevel(users);
  printResult(result);
}

async function runLevel(users) {
  const startedAt = performance.now();
  const workers = Array.from({ length: users }, (_, index) => runUser(index));
  const samples = (await Promise.all(workers)).flat();
  const durationMs = performance.now() - startedAt;
  const failures = samples.filter((sample) => !sample.ok);
  const latencies = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);

  return {
    users,
    requests: samples.length,
    failures: failures.length,
    failureRate: failures.length / Math.max(samples.length, 1),
    durationMs,
    rps: samples.length / (durationMs / 1000),
    p50: percentile(latencies, 0.5),
    p95: percentile(latencies, 0.95),
    p99: percentile(latencies, 0.99),
    slowest: latencies.at(-1) ?? 0,
    failedByEndpoint: countBy(failures, (sample) => `${sample.name} ${sample.status ?? sample.error ?? "ERR"}: ${sample.errorMessage ?? ""}`.trim()),
  };
}

async function runUser(userIndex) {
  const samples = [];

  for (let step = 0; step < requestsPerUser; step += 1) {
    const endpoint = scenario[(userIndex + step) % scenario.length];
    samples.push(await fetchTimed(endpoint));
  }

  return samples;
}

async function fetchTimed(endpoint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(endpoint.url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    await response.arrayBuffer();

    return {
      name: endpoint.name,
      status: response.status,
      ok: response.ok,
      durationMs: performance.now() - startedAt,
    };
  } catch (error) {
    return {
      name: endpoint.name,
      ok: false,
      error: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function printResult(result) {
  const failed = result.failures === 0 ? "0" : `${result.failures} (${(result.failureRate * 100).toFixed(1)}%)`;
  console.log(
    [
      `${result.users} users`,
      `${result.requests} requests`,
      `${result.rps.toFixed(1)} req/s`,
      `p50 ${Math.round(result.p50)}ms`,
      `p95 ${Math.round(result.p95)}ms`,
      `p99 ${Math.round(result.p99)}ms`,
      `max ${Math.round(result.slowest)}ms`,
      `fail ${failed}`,
    ].join(" | "),
  );

  if (result.failures > 0) {
    console.log(JSON.stringify(result.failedByEndpoint, null, 2));
  }
}

function percentile(values, ratio) {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1);
  return values[index];
}

function countBy(values, getKey) {
  return values.reduce((counts, value) => {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
