import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const tempRoot = mkdtempSync(path.join(tmpdir(), "mazetto-media-smoke-"));
const imageTag = "mazetto-media:step13-smoke";
let containerId = "";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

async function status(url) {
  const response = await fetch(url, { method: "GET" });
  await response.body?.cancel();
  return response.status;
}

try {
  run("node", ["apps/media/scripts/prepare-media-release.mjs", "--target", tempRoot]);
  run("docker", ["build", "-f", "apps/media/Dockerfile", "-t", imageTag, "."], {
    stdio: "ignore",
  });
  containerId = run("docker", [
    "run",
    "-d",
    "--rm",
    "-p",
    "18080:80",
    "-v",
    `${tempRoot}:/media:ro`,
    imageTag,
  ]).trim();

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const checks = [
    ["health", "http://127.0.0.1:18080/healthz", 204],
    ["category_lavash", "http://127.0.0.1:18080/categories/lavash.webp", 200],
    ["product_lavash_big", "http://127.0.0.1:18080/products/lavash-big.webp", 200],
    ["product_cheese_fries", "http://127.0.0.1:18080/products/cheese-fries.webp", 200],
    ["unresolved_chicken_strips", "http://127.0.0.1:18080/products/chicken-strips.webp", 404],
  ];

  for (const [name, url, expected] of checks) {
    const actual = await status(url);
    console.log(`${name}=${actual}`);
    if (actual !== expected) {
      throw new Error(`${name} expected ${expected}, got ${actual}`);
    }
  }

  console.log("Mazetto media container smoke passed");
} finally {
  if (containerId) {
    spawnSync("docker", ["stop", containerId], { cwd: repoRoot, stdio: "ignore" });
  }
  rmSync(tempRoot, { recursive: true, force: true });
}
